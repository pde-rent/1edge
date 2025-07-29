'use client'
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

const menuItems = [
  { name: 'Dashboard', href: '/dashboard' }
]

export default function FloatingNavbar() {
  const { login, logout, ready, authenticated, user } = usePrivy();
  const [menuState, setMenuState] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header>
      <nav
        data-state={menuState ? 'active' : ''}
        className="fixed z-50 w-full group"
        style={{ top: 0, left: 0, right: 0, padding: '1rem' }}
      >
        <div 
          className={cn(
            'mx-auto transition-all duration-500 rounded-3xl relative overflow-hidden',
            isScrolled 
              ? 'backdrop-blur-xl border border-emerald-500/30 shadow-2xl shadow-emerald-500/10' 
              : 'backdrop-blur-lg border border-emerald-400/20 shadow-xl shadow-emerald-400/5'
          )}
          style={{
            maxWidth: isScrolled ? '64rem' : '72rem',
            margin: '0 auto',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            paddingTop: '1rem',
            paddingBottom: '1rem',
            background: isScrolled 
              ? 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(6,20,10,0.3) 50%, rgba(0,0,0,0.4) 100%)'
              : 'linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(4,15,8,0.2) 50%, rgba(0,0,0,0.25) 100%)'
          }}
        >
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent opacity-50"></div>
          
          <div className="relative flex items-center justify-between z-10" style={{ minHeight: '2.5rem' }}>
            <div className="flex items-center" style={{ gap: '0.75rem' }}>
              <div 
                className="bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 relative overflow-hidden"
                style={{ width: '2.5rem', height: '2.5rem' }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-xl"></div>
                <span className="text-black font-bold text-lg relative z-10">1E</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight bg-gradient-to-r from-white to-emerald-100 bg-clip-text text-transparent">
                1Edge
              </span>
            </div>

            <div className="hidden lg:flex items-center" style={{ gap: '2.5rem' }}>
              {menuItems.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  className="text-gray-200/90 hover:text-emerald-300 transition-all duration-300 font-medium tracking-wide relative group"
                  style={{ fontSize: '0.875rem' }}
                >
                  <span>{item.name}</span>
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300 group-hover:w-full rounded-full"></span>
                </a>
              ))}
            </div>

            <div className="hidden lg:flex items-center" style={{ gap: '0.75rem' }}>
           
              <button
                onClick={authenticated ? logout : login}
                className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 hover:from-emerald-500/30 hover:to-emerald-600/30 text-emerald-100 border border-emerald-400/30 hover:border-emerald-400/50 backdrop-blur-sm shadow-lg hover:shadow-emerald-500/20 relative overflow-hidden group transform hover:scale-105 transition-all duration-300 rounded-lg flex items-center"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', gap: '0.5rem' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Wallet className="w-4 h-4 relative z-10" />
                <span className="relative z-10">
                  {authenticated ? 'Disconnect' : (isScrolled ? 'Get Started' : 'Connect')}
                </span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuState(!menuState)}
              aria-label={menuState ? 'Close Menu' : 'Open Menu'}
              className="lg:hidden text-gray-200 hover:text-emerald-300 transition-all duration-300 rounded-lg hover:bg-emerald-500/10 backdrop-blur-sm relative"
              style={{ padding: '0.5rem' }}
            >
              <Menu className={cn("size-6 transition-all duration-200", menuState && "rotate-180 scale-0 opacity-0")} />
              <X className={cn("absolute size-6 transition-all duration-200 -rotate-180 scale-0 opacity-0", menuState && "rotate-0 scale-100 opacity-100")} style={{ top: '0.5rem', left: '0.5rem' }} />
            </button>
          </div>

          {menuState && (
            <div className="lg:hidden backdrop-blur-sm" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(52, 211, 153, 0.2)' }}>
              <div className="flex flex-col" style={{ gap: '1rem' }}>
                {menuItems.map((item, index) => (
                  <a 
                    key={index}
                    href={item.href} 
                    className="text-gray-200/90 hover:text-emerald-300 transition-all duration-300 font-medium rounded-lg hover:bg-emerald-500/10 backdrop-blur-sm"
                    style={{ padding: '0.5rem 0.75rem' }}
                  >
                    {item.name}
                  </a>
                ))}
                <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                 
                  <button
                    onClick={authenticated ? logout : login}
                    className="w-full bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 hover:from-emerald-500/30 hover:to-emerald-600/30 text-emerald-100 border border-emerald-400/30 hover:border-emerald-400/50 backdrop-blur-sm shadow-lg hover:shadow-emerald-500/20 relative overflow-hidden group rounded-lg flex items-center justify-center"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', gap: '0.5rem' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <Wallet className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">
                      {authenticated ? 'Disconnect Wallet' : 'Connect Wallet'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}