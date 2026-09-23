"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import SignaturePadLib from "signature_pad";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  toDataUrl: () => string | null;
  clear: () => void;
};

/**
 * Área de assinatura (canvas → PNG). Ajusta a resolução ao devicePixelRatio
 * para o traço ficar nítido no celular e reescala ao girar a tela.
 */
export const SignaturePad = forwardRef<
  SignaturePadHandle,
  { onChange?: (empty: boolean) => void }
>(function SignaturePad({ onChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [empty, setEmpty] = useState(true);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;
    const data = pad.toData();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    pad.clear();
    pad.fromData(data);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePadLib(canvas, {
      penColor: "#0f1419",
      backgroundColor: "rgba(255,255,255,0)",
      minWidth: 0.8,
      maxWidth: 2.6,
    });
    padRef.current = pad;
    const onEnd = () => {
      setEmpty(pad.isEmpty());
      onChange?.(pad.isEmpty());
    };
    pad.addEventListener("endStroke", onEnd);
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      pad.removeEventListener("endStroke", onEnd);
      pad.off();
    };
  }, [onChange, resize]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    toDataUrl: () =>
      padRef.current && !padRef.current.isEmpty()
        ? padRef.current.toDataURL("image/png")
        : null,
    clear: () => {
      padRef.current?.clear();
      setEmpty(true);
      onChange?.(true);
    },
  }));

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="h-48 w-full touch-none rounded-2xl border-2 border-dashed bg-white sm:h-56"
        aria-label="Área para assinar com o dedo ou o mouse"
        role="img"
      />
      {empty && (
        <span className="pointer-events-none absolute inset-x-0 bottom-10 text-center text-sm text-neutral-400">
          Assine aqui
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-neutral-300" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 rounded-full bg-white/80 text-neutral-700 hover:bg-white"
        onClick={() => {
          padRef.current?.clear();
          setEmpty(true);
          onChange?.(true);
        }}
      >
        <Eraser /> Limpar
      </Button>
    </div>
  );
});
