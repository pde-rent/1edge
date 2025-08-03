// components/AuthComponent.tsx
import React, { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Wallet,
  LogOut,
  RefreshCw,
  ChevronDown,
  Settings,
  Copy,
  ExternalLink,
  Network,
} from "lucide-react";
import {
  mainnet,
  sepolia,
  polygon,
  arbitrum,
  base,
  optimism,
} from "viem/chains";
import { toast } from "sonner";

const SUPPORTED_CHAINS = [mainnet, sepolia, polygon, arbitrum, base, optimism];

interface AuthComponentProps {
  variant?: "default" | "compact";
}

const AuthComponent: React.FC<AuthComponentProps> = ({
  variant = "default",
}) => {
  const [isNetworkDialogOpen, setIsNetworkDialogOpen] = useState(false);
  const [isWalletDialogOpen, setIsWalletDialogOpen] = useState(false);

  const { login, logout, ready, authenticated, connectWallet } = usePrivy();

  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address, isConnected, chain } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard");
    }
  };

  const openEtherscan = () => {
    if (address && chain) {
      const explorerUrl = chain.blockExplorers?.default?.url;
      if (explorerUrl) {
        window.open(`${explorerUrl}/address/${address}`, "_blank");
      }
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Loading state
  if (!ready) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-black/40 rounded-lg border border-slate-700/50">
        <RefreshCw className="w-4 h-4 animate-spin text-teal-500" />
        <span className="text-sm text-slate-400">Loading...</span>
      </div>
    );
  }

  // Not authenticated state
  if (!authenticated) {
    return (
      <Button
        onClick={login}
        className="px-6 py-2 bg-[#4fd1c5] text-black font-semibold rounded-xl hover:bg-[#4fd1c5]/90 transition-all duration-300 group"
      >
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
    );
  }

  // Compact variant - combines network and wallet in single button
  if (variant === "compact" && authenticated && isConnected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-black/40 border-slate-600/50 text-slate-300 hover:bg-slate-800/50 flex items-center gap-2 px-2 py-1 h-8"
          >
            {/* Network indicator */}
            {chain && (
              <div className="flex items-center gap-1">
                <Wallet className="w-3 h-3 text-emerald-400" />
                <span className="text-xs font-medium">{chain.name}</span>
              </div>
            )}

            {/* Wallet address */}
            {address && (
              <span className="text-xs font-mono">
                {formatAddress(address)}
              </span>
            )}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-black/95 border-slate-700/50 text-white min-w-[280px]">
          {/* Network Section */}
          <div className="px-3 py-2 text-xs text-slate-400">Network</div>
          <div className="px-1 mb-2">
            {SUPPORTED_CHAINS.map((supportedChain) => (
              <DropdownMenuItem
                key={supportedChain.id}
                onClick={() => switchChain({ chainId: supportedChain.id })}
                disabled={isSwitchingChain || chain?.id === supportedChain.id}
                className={`cursor-pointer rounded ${
                  chain?.id === supportedChain.id
                    ? "bg-teal-900/30 text-teal-200"
                    : "hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{supportedChain.name}</span>
                  {chain?.id === supportedChain.id && (
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </div>

          <DropdownMenuSeparator className="bg-slate-700/50" />

          {/* Wallet Section */}
          {address && (
            <>
              <div className="px-3 py-2 text-xs text-slate-400">Wallet</div>
              <div className="px-3 py-2 bg-slate-800/30 mx-1 rounded mb-2">
                <div className="text-sm font-mono text-slate-200 mb-1">
                  {formatAddress(address)}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={copyAddress}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs hover:bg-slate-700/50"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    onClick={openEtherscan}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs hover:bg-slate-700/50"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Explorer
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Switch Wallets */}
          {wallets.length > 1 && (
            <>
              <div className="px-3 py-2 text-xs text-slate-400">
                Other Wallets ({wallets.length - 1})
              </div>
              {wallets
                .filter((wallet) => wallet.address !== address)
                .map((wallet) => (
                  <DropdownMenuItem
                    key={wallet.address}
                    onClick={() => setActiveWallet(wallet)}
                    className="cursor-pointer hover:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-mono">
                        {formatAddress(wallet.address)}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">
                        {wallet.walletClientType}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator className="bg-slate-700/50" />
            </>
          )}

          {/* Actions */}
          <DropdownMenuItem
            onClick={connectWallet}
            className="cursor-pointer hover:bg-slate-800/50"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Another Wallet
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-slate-700/50" />

          <DropdownMenuItem
            onClick={logout}
            className="cursor-pointer hover:bg-red-900/30 text-red-300"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect All
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default variant - authenticated state with separate network and wallet buttons
  return (
    <div className="flex items-center gap-2">
      {/* Network Display & Switcher */}
      {isConnected && chain && (
        <Dialog
          open={isNetworkDialogOpen}
          onOpenChange={setIsNetworkDialogOpen}
        >
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-black/40 border-slate-600/50 text-slate-300 hover:bg-slate-800/50 flex items-center gap-2"
            >
              <span className="text-xs font-medium">{chain.name}</span>
              <Network className="w-3 h-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black/95 border-slate-700/50 text-white">
            <DialogHeader>
              <DialogTitle className="text-teal-400">
                Switch Network
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {SUPPORTED_CHAINS.map((supportedChain) => (
                <Button
                  key={supportedChain.id}
                  onClick={() => {
                    switchChain({ chainId: supportedChain.id });
                    setIsNetworkDialogOpen(false);
                  }}
                  disabled={isSwitchingChain || chain?.id === supportedChain.id}
                  variant={
                    chain?.id === supportedChain.id ? "default" : "outline"
                  }
                  className={`w-full justify-start ${
                    chain?.id === supportedChain.id
                      ? "bg-teal-600 border-teal-500"
                      : "bg-black/40 border-slate-600/50 hover:bg-slate-800/50"
                  }`}
                >
                  <span>{supportedChain.name}</span>
                  {chain?.id === supportedChain.id && (
                    <span className="ml-auto text-xs bg-teal-400/20 px-2 py-1 rounded">
                      Current
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Wallet Display & Manager */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="bg-black/40 border-slate-600/50 text-slate-300 hover:bg-slate-800/50 flex items-center gap-2"
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            {address && (
              <span className="text-sm font-mono">
                {formatAddress(address)}
              </span>
            )}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-black/95 border-slate-700/50 text-white min-w-[250px]">
          {/* Current Wallet Info */}
          {address && (
            <>
              <div className="px-3 py-2 text-xs text-slate-400">
                Active Wallet
              </div>
              <div className="px-3 py-2 bg-slate-800/30 mx-1 rounded">
                <div className="text-sm font-mono text-slate-200 mb-1">
                  {formatAddress(address)}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={copyAddress}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs hover:bg-slate-700/50"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    onClick={openEtherscan}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs hover:bg-slate-700/50"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Explorer
                  </Button>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-slate-700/50" />
            </>
          )}

          {/* Switch Wallets */}
          {wallets.length > 1 && (
            <>
              <div className="px-3 py-2 text-xs text-slate-400">
                Switch Wallet ({wallets.length} connected)
              </div>
              {wallets.map((wallet) => (
                <DropdownMenuItem
                  key={wallet.address}
                  onClick={() => setActiveWallet(wallet)}
                  className={`cursor-pointer ${
                    wallet.address === address
                      ? "bg-teal-900/30 text-teal-200"
                      : "hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-mono">
                      {formatAddress(wallet.address)}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">
                      {wallet.walletClientType}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-slate-700/50" />
            </>
          )}

          {/* Actions */}
          <DropdownMenuItem
            onClick={connectWallet}
            className="cursor-pointer hover:bg-slate-800/50"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Another Wallet
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-slate-700/50" />

          <DropdownMenuItem
            onClick={logout}
            className="cursor-pointer hover:bg-red-900/30 text-red-300"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect All
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default AuthComponent;
