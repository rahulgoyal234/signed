import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const Background3D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    } catch {
      // Graceful fallback if WebGL is unavailable
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function css(n: string): string {
      return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    }

    const papers: THREE.Mesh[] = [];
    const mats: THREE.MeshBasicMaterial[] = [];

    function tex(kind: number): THREE.CanvasTexture {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 340;
      const x = c.getContext('2d');
      if (x) {
        x.fillStyle = '#fff';
        x.fillRect(0, 0, 256, 340);
        x.strokeStyle = 'rgba(40,36,90,.35)';
        x.lineWidth = 3;
        x.strokeRect(6, 6, 244, 328);
        x.fillStyle = 'rgba(40,36,90,.55)';
        if (kind === 0) {
          x.font = '700 190px Georgia,serif';
          x.textAlign = 'center';
          x.fillText('?', 128, 225);
        } else if (kind === 1) {
          x.font = '700 190px Georgia,serif';
          x.textAlign = 'center';
          x.fillText('\u00a7', 128, 225);
        } else {
          for (let i = 0; i < 12; i++) {
            x.fillRect(30, 50 + i * 22, i % 4 === 3 ? 110 : 196, 6);
          }
        }
        x.fillStyle = '#b3261e';
        x.beginPath();
        x.arc(206, 296, 16, 0, 7);
        x.fill();
      }
      return new THREE.CanvasTexture(c);
    }

    const T = [tex(0), tex(1), tex(2)];
    const gp = new THREE.PlaneGeometry(1.5, 2);

    for (let i = 0; i < 90; i++) {
      const m = new THREE.MeshBasicMaterial({
        map: T[i % 3],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      });
      mats.push(m);
      const p = new THREE.Mesh(gp, m);
      const a = i * 0.55;
      const r = 4 + Math.random() * 7;
      p.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, -i * 1.4 + 2);
      p.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      p.userData.s = (Math.random() - 0.5) * 0.012;
      sc.add(p);
      papers.push(p);
    }

    const brassMat = new THREE.MeshStandardMaterial({ metalness: 0.55, roughness: 0.32 });
    for (let j = 0; j < 7; j++) {
      const rg = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.06, 12, 90), brassMat);
      rg.position.z = -14 - j * 17;
      sc.add(rg);
    }

    const qm = new THREE.Group();
    const hook = new THREE.Mesh(new THREE.TorusGeometry(1, 0.24, 24, 64, Math.PI * 1.5), brassMat);
    hook.rotation.z = -Math.PI / 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.8, 24), brassMat);
    stem.position.y = -1.4;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), brassMat);
    dot.position.y = -2.4;
    qm.add(hook, stem, dot);
    sc.add(qm);

    const seal = new THREE.PointLight(0xffffff, 1.2, 60);
    sc.add(seal);
    sc.add(new THREE.AmbientLight(0xffffff, 0.7));

    function theme() {
      const bgVal = css('--bg') || '#ece9f7';
      const bg = new THREE.Color(bgVal);
      renderer.setClearColor(bg);
      sc.fog = new THREE.Fog(bg, 18, 60);
      const brassVal = css('--brass') || '#9a6b12';
      brassMat.color.set(brassVal);
      const tintVal = css('--tint') || '#ffffff';
      const t = new THREE.Color(tintVal);
      mats.forEach((m) => m.color.copy(t));
    }

    theme();
    const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    darkMedia.addEventListener('change', theme);

    let W = window.innerWidth;
    let H = window.innerHeight;
    let boardTop = 1;
    let sy = window.scrollY || 0;
    let tp = 0;
    let mx = 0;
    let my = 0;

    function size() {
      W = window.innerWidth;
      H = window.innerHeight;
      renderer.setSize(W, H, false);
      cam.aspect = W / H;
      cam.updateProjectionMatrix();

      const b = document.getElementById('room');
      if (b) {
        boardTop = Math.max(1, b.getBoundingClientRect().top + window.scrollY);
      }
      const wide = W / H > 1;
      qm.position.set(wide ? 2.6 : 0, wide ? 0.2 : 1.6, -4);
      qm.scale.setScalar(wide ? 1.5 : 1);
    }

    window.addEventListener('resize', size);
    size();

    const onScroll = () => {
      sy = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const onPointerMove = (e: PointerEvent) => {
      mx = e.clientX / W - 0.5;
      my = e.clientY / H - 0.5;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let animId: number;
    function loop(t: number) {
      const p = Math.min(1, sy / boardTop);
      tp += (p - tp) * 0.07;
      const z = 6 - tp * 130;
      cam.position.set(Math.sin(tp * 9) * 1.4 + mx * 1.2, Math.cos(tp * 7) * 0.9 - my * 0.8, z);
      cam.rotation.z = tp * 0.9 + mx * 0.05;
      cam.lookAt(Math.sin((tp + 0.02) * 9) * 1.4, Math.cos((tp + 0.02) * 7) * 0.9, z - 10);
      seal.position.set(cam.position.x, cam.position.y, z - 3);

      if (!reduce) {
        papers.forEach((pMesh) => {
          pMesh.rotation.x += pMesh.userData.s;
          pMesh.rotation.y += pMesh.userData.s * 1.3;
        });
        qm.rotation.y = Math.sin(t * 0.0006) * 0.6 + mx * 0.6;
        qm.rotation.x = my * 0.3;
      }

      renderer.render(sc, cam);
      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', size);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      darkMedia.removeEventListener('change', theme);
      renderer.dispose();
      gp.dispose();
      T.forEach((texture) => texture.dispose());
      mats.forEach((m) => m.dispose());
      brassMat.dispose();
    };
  }, []);

  return <canvas id="gl" ref={canvasRef} aria-hidden="true" />;
};
