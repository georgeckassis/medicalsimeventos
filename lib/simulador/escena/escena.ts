import * as THREE from "three";

/**
 * Escena 3D: la vista del endoscopio sobre la cavidad. Unidades: centímetros,
 * Y hacia arriba.
 */
export class Escena {
  readonly renderer: THREE.WebGLRenderer;
  readonly escena = new THREE.Scene();
  readonly camara = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 200);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.escena.background = new THREE.Color(0x1a0a0a);
    this.escena.fog = new THREE.Fog(0x1a0a0a, 30, 70);

    // Luz principal desde arriba: las sombras de los instrumentos son la
    // mejor pista de profundidad en una pantalla plana.
    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(3, 25, 6);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.camera.left = -25;
    sol.shadow.camera.right = 25;
    sol.shadow.camera.top = 25;
    sol.shadow.camera.bottom = -25;
    sol.shadow.bias = -0.0005;
    this.escena.add(sol, new THREE.HemisphereLight(0xffeeee, 0x442222, 0.9));

    // La luz del endoscopio viaja con la cámara.
    const luzEndoscopio = new THREE.PointLight(0xfff4e6, 60, 60, 1.5);
    this.camara.add(luzEndoscopio);
    this.escena.add(this.camara);

    const piso = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x9c4a42, roughness: 0.85 }),
    );
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    this.escena.add(piso);
  }

  ubicarCamara(posicion: THREE.Vector3, mira: THREE.Vector3): void {
    this.camara.position.copy(posicion);
    this.camara.lookAt(mira);
  }

  redimensionar(ancho: number, alto: number): void {
    if (ancho === 0 || alto === 0) return;
    this.renderer.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
  }

  renderizar(): void {
    this.renderer.render(this.escena, this.camara);
  }

  destruir(): void {
    this.escena.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        const materiales = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materiales) m.dispose();
      }
    });
    this.renderer.dispose();
  }
}
