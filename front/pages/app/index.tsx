// @ts-nocheck
import Head from 'next/head';
import { HeroGeometric } from '@/components/ui/shape-landing-hero';
import TradingDashboard from '@/components/TradingDashboard';

export default function Home() {
  return (
    <>
      <Head>
        <title>1edge - Elevate Your Digital Vision</title>
        <meta name="description" content="Crafting exceptional digital experiences through innovative design and cutting-edge technology." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
     <TradingDashboard/>
    </>
  );
}