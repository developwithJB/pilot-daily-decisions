import { useEffect, useRef } from "react";
import type { RefObject } from "react";

// Chroma-key on the GPU, preserving the generated model's actual silhouette.
export function KeyedModel({
  videoRef,
  canvasRef,
  poster,
  onError,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  poster: string;
  onError: (message: string) => void;
}) {
  const errorRef = useRef(onError);
  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      errorRef.current(
        "This browser cannot render the fitting preview. Enable WebGL and reload.",
      );
      return;
    }
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error("Could not initialize the image renderer.");
      return s;
    };
    let frame = 0;
    let disposed = false;
    const vs = shader(
      gl.VERTEX_SHADER,
      "attribute vec2 p; varying vec2 uv; void main(){uv=vec2((p.x+1.0)*0.5,(1.0-p.y)*0.5);gl_Position=vec4(p,0,1);}",
    );
    const fs = shader(
      gl.FRAGMENT_SHADER,
      `precision mediump float; varying vec2 uv; uniform sampler2D media;
      void main(){vec4 c=texture2D(media,uv); float green=c.g-max(c.r,c.b);
      float a=1.0-smoothstep(0.08,0.32,green); c.g=mix(c.g,min(c.g,max(c.r,c.b)),smoothstep(0.015,0.2,green));
      gl_FragColor=vec4(c.rgb,a);}`,
    );
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const p = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const still = new Image();
    still.src = poster;
    still.onerror = () =>
      errorRef.current("The outfit image could not load. Reload to retry.");
    let lastTime = -1,
      lastKind = "";
    function render() {
      if (disposed) return;
      const video = videoRef.current;
      const hasVideo = video && video.readyState >= 2 && video.videoWidth > 0;
      const source = hasVideo ? video : still;
      const kind = hasVideo ? "video" : "image";
      const ready = hasVideo || (still.complete && still.naturalWidth > 0);
      const time = hasVideo ? video.currentTime : 0;
      if (ready && (lastTime !== time || lastKind !== kind)) {
        const w = hasVideo ? video.videoWidth : still.naturalWidth;
        const h = hasVideo ? video.videoHeight : still.naturalHeight;
        if (canvas!.width !== w || canvas!.height !== h) {
          canvas!.width = w;
          canvas!.height = h;
          gl!.viewport(0, 0, w, h);
        }
        gl!.texImage2D(
          gl!.TEXTURE_2D,
          0,
          gl!.RGBA,
          gl!.RGBA,
          gl!.UNSIGNED_BYTE,
          source,
        );
        gl!.drawArrays(gl!.TRIANGLES, 0, 6);
        lastTime = time;
        lastKind = kind;
      }
      frame = requestAnimationFrame(render);
    }
    render();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      still.onload = null;
      still.onerror = null;
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [poster, videoRef, canvasRef]);
  return (
    <canvas
      ref={canvasRef}
      aria-label="Sample model wearing the selected outfit"
    />
  );
}
