import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { ArrowRight, Check, ChefHat, Clock3, Leaf, Minus, Plus, ShoppingBag, User, X } from 'lucide-react'
import { request } from '../../lib/api.js'
import { money } from '../../lib/money.js'

export function OrderProgress({ order, table, onNewOrder }) {
  const steps = ['Pending', 'Preparing', 'Ready', 'Served']
  const current = steps.indexOf(order.status)
  const items = order.items || []
  const lineTotal = item => item.price * item.quantity
  return <section className="mx-auto max-w-lg rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm sm:p-6"><div className="mx-auto grid size-12 place-items-center rounded-full bg-[#fff1e6] text-[#b5571d]"><Check size={23} /></div><h2 className="font-display mt-4 text-xl font-bold">Order received</h2><p className="mt-2 break-words text-xs text-stone-500">{order.customerName ? `${order.customerName} · ` : ''}Order #{String(order._id).slice(-6).toUpperCase()} · Table {table}</p><div className="my-7 flex">{steps.map((step, index) => <div key={step} className="relative flex min-w-0 flex-1 flex-col items-center gap-2"><span className={`z-[1] grid size-8 place-items-center rounded-full text-[10px] font-semibold ${index <= current ? 'bg-[#b5571d] text-white' : 'bg-stone-100 text-stone-400'}`}>{index < current ? <Check size={14} /> : index + 1}</span><span className="text-center text-[8px] text-stone-500 min-[380px]:text-[9px]">{step}</span>{index < steps.length - 1 && <i className={`absolute left-[55%] top-4 h-px w-full ${index < current ? 'bg-[#d88340]' : 'bg-stone-200'}`} />}</div>)}</div>
    {items.length > 0 && <div className="mb-5 rounded-xl border border-stone-100 bg-stone-50/60 p-3 text-left">
      <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[1px] text-stone-400"><ShoppingBag size={11} />Your order</p>
      {order.customerName && <p className="mb-2.5 flex items-center gap-1.5 rounded-lg bg-[#fff5ed] px-2 py-1.5 text-[11px] font-semibold text-[#a34b16]"><User size={12} className="shrink-0" />For {order.customerName}</p>}
      <ul className="space-y-1.5">{items.map((item, index) => <li key={index} className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 break-words text-stone-700">{item.name}<b className="ml-1.5 whitespace-nowrap text-[10px] text-[#b5571d]">×{item.quantity}</b></span>
        <b className="shrink-0 whitespace-nowrap font-semibold text-stone-600">{money(lineTotal(item))}</b>
      </li>)}</ul>
      <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-stone-200 pt-2.5 text-xs">
        <span className="font-semibold text-stone-500">Total · {items.reduce((total, item) => total + item.quantity, 0)} {items.reduce((total, item) => total + item.quantity, 0) === 1 ? 'item' : 'items'}</span>
        <b className="font-bold text-stone-800">{money(order.totalAmount)}</b>
      </div>
    </div>}
    <p className="flex items-center justify-center gap-1.5 text-[10px] text-stone-500"><Clock3 className="shrink-0" size={12} />Status updates appear here automatically</p><button onClick={onNewOrder} className="mt-5 text-xs font-semibold text-[#b5571d]">Back to menu</button></section>
}
