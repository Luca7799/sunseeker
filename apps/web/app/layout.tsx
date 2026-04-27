import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Toaster } from '@/components/ui/Toaster'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Sunseeker — Find the Sun in Palma',
  description:
    'Discover cafés, terraces, and parks in direct sunlight right now in Palma de Mallorca.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-stone-50 font-sans text-stone-900 antialiased">
        <Toaster>
          <Header />
          <main className="relative">{children}</main>
        </Toaster>
      </body>
    </html>
  )
}
