import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { ArrowRight, Check, ChefHat, Clock3, Leaf, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { request } from '../../lib/api.js'
import { money } from '../../lib/money.js'

export function Brand() {
  return <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#c65d1b] text-white"><Leaf size={16} /></span><span className="font-display text-base font-extrabold tracking-tight">WAGA <span className="text-[#df8746]">BITS</span></span></div>
}
