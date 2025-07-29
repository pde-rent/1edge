import ccxt from 'ccxt';

async function testExchange() {
  console.log('Testing exchange connectivity...');
  
  try {
    // Test Binance
    const binance = new ccxt.binance({ 
      enableRateLimit: true,
      sandbox: false
    });
    
    console.log('Testing Binance...');
    const btcTicker = await binance.fetchTicker('BTC/USDT');
    console.log('Binance BTC/USDT:', btcTicker.last);
    
    await binance.close();
    
    // Test OKX
    const okx = new ccxt.okx({ 
      enableRateLimit: true,
      sandbox: false
    });
    
    console.log('Testing OKX...');
    const okxTicker = await okx.fetchTicker('BTC-USDT');
    console.log('OKX BTC-USDT:', okxTicker.last);
    
    await okx.close();
    
    console.log('Exchange connectivity test passed!');
  } catch (error) {
    console.error('Exchange test failed:', error.message);
  }
}

testExchange().then(() => process.exit(0)).catch(console.error);