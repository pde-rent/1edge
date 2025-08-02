// @ts-nocheck
import Head from "next/head";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";

/**
 * Home page - Landing page with hero section
 */
export default function Home() {
  return (
    <>
      <Head>
        <title>1edge - Elevate Your Digital Vision</title>
        <meta
          name="description"
          content="Crafting exceptional digital experiences through innovative design and cutting-edge technology."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <HeroGeometric
        badge="⚡ Advanced Orders using LOP"
        title1="Trade Smarter,"
        title2="Execute Better"
      />
    </>
  );
}
