import ccxt from 'ccxt';

async function debugSymbols() {
  console.log('Testing symbol formats...');
  
  try {
    // Test Binance
    const binance = new ccxt.binance({ enableRateLimit: true });
    
    console.log('Binance - testing different formats:');
    
    // Our format from config
    console.log('Testing BTCUSDT...');
    try {
      const ticker1 = await binance.fetchTicker('BTCUSDT');
      console.log('✓ BTCUSDT works:', ticker1.last);
    } catch (e) {
      console.log('✗ BTCUSDT failed:', e.message);
    }
    
    // Standard format
    console.log('Testing BTC/USDT...');
    try {
      const ticker2 = await binance.fetchTicker('BTC/USDT');
      console.log('✓ BTC/USDT works:', ticker2.last);
    } catch (e) {
      console.log('✗ BTC/USDT failed:', e.message);
    }
    
    await binance.close();
    
    // Test OKX
    const okx = new ccxt.okx({ enableRateLimit: true });
    
    console.log('\\nOKX - testing different formats:');
    
    console.log('Testing BTC-USDT...');
    try {
      const ticker3 = await okx.fetchTicker('BTC-USDT');
      console.log('✓ BTC-USDT works:', ticker3.last);
    } catch (e) {
      console.log('✗ BTC-USDT failed:', e.message);
    }
    
    console.log('Testing BTC/USDT...');
    try {
      const ticker4 = await okx.fetchTicker('BTC/USDT');
      console.log('✓ BTC/USDT works:', ticker4.last);
    } catch (e) {
      console.log('✗ BTC/USDT failed:', e.message);
    }
    
    await okx.close();
    
  } catch (error) {
    console.error('Debug failed:', error.message);
  }
}

debugSymbols().then(() => process.exit(0)).catch(console.error);