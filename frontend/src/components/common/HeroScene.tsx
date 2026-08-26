import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import type { Group, Mesh } from "three";

const BRAND = "#a81243";
const BRAND_BRIGHT = "#d4235c";
const GOLD = "#f0b429";
const PLUM = "#43195f";

/** A single glossy shape that slowly rotates on its own axis. */
function Shape({
  color,
  spin = 0.15,
  children,
  ...props
}: {
  color: string;
  spin?: number;
} & ThreeElements["mesh"]) {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * spin;
    ref.current.rotation.y += delta * spin * 0.7;
  });
  return (
    <mesh ref={ref} {...props}>
      {children}
      <meshPhysicalMaterial
        color={color}
        roughness={0.28}
        metalness={0.15}
        clearcoat={1}
        clearcoatRoughness={0.2}
        reflectivity={0.6}
        emissive={color}
        emissiveIntensity={0.06}
      />
    </mesh>
  );
}

/** The whole cluster tilts gently toward the pointer for a subtle parallax. */
function Cluster({ pointer }: { pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const targetY = pointer.current.x * 0.35;
    const targetX = -pointer.current.y * 0.25;
    // ease toward the target so movement stays smooth and calm
    group.current.rotation.y += (targetY - group.current.rotation.y) * Math.min(1, delta * 2.2);
    group.current.rotation.x += (targetX - group.current.rotation.x) * Math.min(1, delta * 2.2);
  });

  const shapes = useMemo(
    () => (
      <>
        <Float speed={1.1} rotationIntensity={0.35} floatIntensity={0.7}>
          <Shape position={[0, 0.15, 0]} color={BRAND} spin={0.12}>
            <icosahedronGeometry args={[1.15, 0]} />
          </Shape>
        </Float>
        <Float speed={1.4} rotationIntensity={0.5} floatIntensity={0.9}>
          <Shape position={[1.9, 1.1, -0.8]} color={GOLD} spin={0.2}>
            <torusGeometry args={[0.5, 0.2, 24, 64]} />
          </Shape>
        </Float>
        <Float speed={1.25} rotationIntensity={0.4} floatIntensity={0.8}>
          <Shape position={[-1.95, -0.75, -0.4]} color={PLUM} spin={0.16}>
            <dodecahedronGeometry args={[0.62, 0]} />
          </Shape>
        </Float>
        <Float speed={1.6} rotationIntensity={0.6} floatIntensity={1}>
          <Shape position={[1.55, -1.15, 0.4]} color={BRAND_BRIGHT} spin={0.22}>
            <capsuleGeometry args={[0.22, 0.5, 8, 20]} />
          </Shape>
        </Float>
        <Float speed={1.35} rotationIntensity={0.45} floatIntensity={0.85}>
          <Shape position={[-1.5, 1.35, 0.2]} color={GOLD} spin={0.18}>
            <octahedronGeometry args={[0.42, 0]} />
          </Shape>
        </Float>
      </>
    ),
    [],
  );

  return <group ref={group}>{shapes}</group>;
}

export function HeroScene() {
  const pointer = useRef({ x: 0, y: 0 });
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // respect users who prefer reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(!mq.matches);
    update();
    mq.addEventListener("change", update);

    // track the pointer at the window level so the canvas never blocks clicks
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);

    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{ maskImage: "radial-gradient(120% 100% at 70% 40%, #000 55%, transparent 100%)" }}
    >
      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 0, 6], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        frameloop={enabled ? "always" : "demand"}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 5]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-5, -2, 2]} intensity={0.5} color={GOLD} />
        <pointLight position={[0, 0, 4]} intensity={0.6} color={BRAND_BRIGHT} />
        <Suspense fallback={null}>
          <Cluster pointer={pointer} />
        </Suspense>
      </Canvas>
    </div>
  );
}
