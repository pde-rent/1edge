// @ts-nocheck
import Head from "next/head";
import EnhancedLandingPage from "@/components/ui/shape-landing-hero";

/**
 * Home page - Landing page with hero section
 */
export default function Home() {
  return (
    <>
      <Head>
        <title>1edge</title>
        <meta
          name="description"
          content="Crafting exceptional digital experiences through innovative design and cutting-edge technology."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <EnhancedLandingPage />
    </>
  );
}
