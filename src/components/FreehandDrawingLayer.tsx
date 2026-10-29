import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawingStroke, DrawingPoint, DrawingSettings } from '../types/drawing';

interface FreehandDrawingLayerProps {
  pageNumber: number;
  canvasWidth: number;
  canvasHeight: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
  strokes: DrawingStroke[];
  onStrokesChange: (pageNumber: number, newStrokes: DrawingStroke[]) => void;
  isDrawingMode: boolean;
  settings: DrawingSettings;
}

export const FreehandDrawingLayer: React.FC<FreehandDrawingLayerProps> = ({
  pageNumber,
  canvasWidth,
  canvasHeight,
  pdfPageWidth,
  pdfPageHeight,
  strokes,
  onStrokesChange,
  isDrawingMode,
  settings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokePoints = useRef<DrawingPoint[]>([]);

  // Scale ratio between canvas rendered pixels and original PDF points
  const scaleX = pdfPageWidth > 0 ? canvasWidth / pdfPageWidth : 1;
  const scaleY = pdfPageHeight > 0 ? canvasHeight / pdfPageHeight : 1;

  // Render all committed strokes + active in-progress stroke
  const redrawAllStrokes = useCallback(
    (activePoints: DrawingPoint[] = []) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);

      // Helper function to draw a single stroke
      const drawSingleStroke = (
        points: DrawingPoint[],
        color: string,
        strokeWidth: number,
        opacity: number,
        tool: 'pen' | 'highlighter'
      ) => {
        if (points.length === 0) return;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(strokeWidth * scaleX, 1);
        ctx.lineCap = tool === 'highlighter' ? 'square' : 'round';
        ctx.lineJoin = tool === 'highlighter' ? 'miter' : 'round';

        if (points.length === 1) {
          // Single dot
          const p = points[0];
          ctx.beginPath();
          ctx.arc(p.x * scaleX, p.y * scaleY, ctx.lineWidth / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (points.length === 2) {
          // Simple line
          ctx.beginPath();
          ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);
          ctx.lineTo(points[1].x * scaleX, points[1].y * scaleY);
          ctx.stroke();
        } else {
          // Quadratic Bezier curve smoothing for natural fluid inking
          ctx.beginPath();
          ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);

          for (let i = 1; i < points.length - 1; i++) {
            const pCurrent = points[i];
            const pNext = points[i + 1];
            const midX = ((pCurrent.x + pNext.x) / 2) * scaleX;
            const midY = ((pCurrent.y + pNext.y) / 2) * scaleY;
            ctx.quadraticCurveTo(pCurrent.x * scaleX, pCurrent.y * scaleY, midX, midY);
          }

          const last = points[points.length - 1];
          ctx.lineTo(last.x * scaleX, last.y * scaleY);
          ctx.stroke();
        }

        ctx.restore();
      };

      // 1. Draw all saved strokes for this page
      for (const stroke of strokes) {
        drawSingleStroke(
          stroke.points,
          stroke.color,
          stroke.width,
          stroke.opacity,
          stroke.tool
        );
      }

      // 2. Draw current active live stroke (if any)
      if (activePoints.length > 0 && settings.tool !== 'eraser') {
        drawSingleStroke(
          activePoints,
          settings.color,
          settings.width,
          settings.opacity,
          settings.tool
        );
      }

      ctx.restore();
    },
    [strokes, scaleX, scaleY, settings]
  );

  // Resize canvas when canvas dimensions or device pixel ratio change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasWidth === 0 || canvasHeight === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    redrawAllStrokes();
  }, [canvasWidth, canvasHeight, redrawAllStrokes]);

  // Redraw when strokes array or page changes
  useEffect(() => {
    redrawAllStrokes();
  }, [strokes, redrawAllStrokes]);

  // Convert Pointer/Mouse Event to PDF point coordinates
  const getPdfCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): DrawingPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const pdfX = (clientX / canvasWidth) * pdfPageWidth;
    const pdfY = (clientY / canvasHeight) * pdfPageHeight;

    return {
      x: Math.max(0, Math.min(pdfX, pdfPageWidth)),
      y: Math.max(0, Math.min(pdfY, pdfPageHeight)),
      pressure: e.pressure || 0.5,
    };
  };

  // Distance helper from point (px, py) to line segment (x1, y1)-(x2, y2)
  const distToSegment = (
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  };

  // Erase any stroke that intersects with the pointer position
  const handleEraserAtPoint = (point: DrawingPoint) => {
    const eraseRadius = (16 / canvasWidth) * pdfPageWidth; // ~16px radius in PDF points
    let strokeRemoved = false;

    const remainingStrokes = strokes.filter(stroke => {
      // Fast bounding box check
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = eraseRadius + (stroke.width / 2);
      if (
        point.x < minX - pad ||
        point.x > maxX + pad ||
        point.y < minY - pad ||
        point.y > maxY + pad
      ) {
        return true; // Not hitting bounding box
      }

      // Check distance to points and segments
      for (let i = 0; i < stroke.points.length; i++) {
        const p1 = stroke.points[i];
        if (Math.hypot(point.x - p1.x, point.y - p1.y) <= pad) {
          strokeRemoved = true;
          return false;
        }
        if (i < stroke.points.length - 1) {
          const p2 = stroke.points[i + 1];
          if (distToSegment(point.x, point.y, p1.x, p1.y, p2.x, p2.y) <= pad) {
            strokeRemoved = true;
            return false;
          }
        }
      }

      return true;
    });

    if (strokeRemoved) {
      onStrokesChange(pageNumber, remainingStrokes);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.setPointerCapture(e.pointerId);
    }

    const point = getPdfCoordinates(e);

    if (settings.tool === 'eraser') {
      setIsDrawing(true);
      handleEraserAtPoint(point);
      return;
    }

    setIsDrawing(true);
    currentStrokePoints.current = [point];
    redrawAllStrokes(currentStrokePoints.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode) return;
    e.preventDefault();
    e.stopPropagation();

    const point = getPdfCoordinates(e);

    if (settings.tool === 'eraser') {
      handleEraserAtPoint(point);
      return;
    }

    // Add point if moved at least 1.5 PDF points to prevent redundant jitter
    const lastPoint = currentStrokePoints.current[currentStrokePoints.current.length - 1];
    if (
      !lastPoint ||
      Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= 1.5
    ) {
      currentStrokePoints.current.push(point);
      redrawAllStrokes(currentStrokePoints.current);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    setIsDrawing(false);

    if (settings.tool === 'eraser') {
      return;
    }

    if (currentStrokePoints.current.length > 0) {
      const newStroke: DrawingStroke = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        points: [...currentStrokePoints.current],
        color: settings.color,
        width: settings.width,
        opacity: settings.opacity,
        tool: settings.tool,
        timestamp: Date.now(),
      };

      const updatedStrokes = [...strokes, newStroke];
      onStrokesChange(pageNumber, updatedStrokes);
      currentStrokePoints.current = [];
      redrawAllStrokes();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    currentStrokePoints.current = [];
    redrawAllStrokes();
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`absolute inset-0 z-20 transition-opacity ${
        isDrawingMode
          ? settings.tool === 'eraser'
            ? 'cursor-cell pointer-events-auto touch-none'
            : 'cursor-crosshair pointer-events-auto touch-none'
          : 'pointer-events-none'
      }`}
      style={{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
      }}
    />
  );
};
