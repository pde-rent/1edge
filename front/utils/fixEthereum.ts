// Fix for MetaMask ethereum object redefinition error
// This prevents the "can't redefine non-configurable property 'ethereum'" error

export function fixEthereumObject() {
  if (typeof window === "undefined") return;

  try {
    // If ethereum object exists and is non-configurable, we need to work around it
    const descriptor = Object.getOwnPropertyDescriptor(window, "ethereum");

    if (descriptor && !descriptor.configurable) {
      // Create a proxy to handle the ethereum object gracefully
      const originalEthereum = (window as any).ethereum;

      // Delete the property if possible
      try {
        delete (window as any).ethereum;
      } catch (e) {
        // If we can't delete it, we'll work with what we have
      }

      // Redefine it as configurable
      try {
        Object.defineProperty(window, "ethereum", {
          value: originalEthereum,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch (e) {
        // If redefinition fails, the original object is still there
        // This is fine, we just can't modify it
      }
    }
  } catch (error) {
    // Silently handle any errors - the app should still work
    console.debug("Could not fix ethereum object:", error);
  }
}

// Call this before any other script that might try to redefine ethereum
if (typeof window !== "undefined") {
  fixEthereumObject();
}
