"use client";

import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type * as THREE from "three";
import { innerDiameterMm } from "@/lib/ring/sizing";
import type { Catalog, RingConfig } from "@/lib/ring/types";
import { RingModel } from "./ring-model";

interface Props {
  config: RingConfig;
  catalog: Catalog;
  /** Receives the canvas element, used to take a thumbnail when saving. */
  onCanvas?: (canvas: HTMLCanvasElement) => void;
  /** Receives the ring's root object, used to export the STL. */
  groupRef?: React.Ref<THREE.Group>;
}

export function RingCanvas({ config, catalog, onCanvas, groupRef }: Props) {
  const outerRadius = innerDiameterMm(config.sizeUs) / 2 + config.bandThicknessMm * 1.3;

  return (
    <Canvas
      camera={{ position: [0, 12, 78], fov: 30 }}
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
      onCreated={({ gl }) => onCanvas?.(gl.domElement)}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[10, 20, 15]} intensity={1.2} />
      <RingModel config={config} catalog={catalog} groupRef={groupRef} />
      <ContactShadows position={[0, -outerRadius - 0.5, 0]} opacity={0.35} scale={60} blur={2.5} far={20} />
      <OrbitControls enablePan={false} minDistance={35} maxDistance={140} target={[0, 4, 0]} />
      {/* A studio light box built in code, so nothing is fetched from another site.
          The warm grey base keeps polished metal from reflecting a black void. */}
      <Environment resolution={256}>
        <color attach="background" args={["#cfc8b8"]} />
        <Lightformer form="rect" intensity={3} position={[0, 12, 10]} scale={[24, 6, 1]} />
        <Lightformer form="rect" intensity={2} position={[-16, 4, -4]} rotation={[0, Math.PI / 2, 0]} scale={[20, 4, 1]} />
        <Lightformer form="rect" intensity={2} position={[16, 4, -4]} rotation={[0, -Math.PI / 2, 0]} scale={[20, 4, 1]} />
        <Lightformer form="ring" intensity={1.5} position={[0, -12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={10} />
      </Environment>
    </Canvas>
  );
}
