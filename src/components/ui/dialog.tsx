"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const TEXT_FIELD = 'input, textarea, select, [contenteditable="true"]'

/**
 * iPhone Safari scrolls the page behind a pop-up to make room for the
 * keyboard, and often leaves it scrolled when the keyboard closes. From then
 * on taps in the pop-up land below where things are drawn: you had to tap
 * above a button to press it. So when focus leaves the pop-up's text fields,
 * or the keyboard closes, put the page back where it was when the pop-up
 * opened. Does nothing where the page never moved (desktops, Android).
 */
function useKeyboardScrollRestore(node: HTMLElement | null) {
  React.useEffect(() => {
    if (!node || typeof window === "undefined") return
    const savedX = window.scrollX
    const savedY = window.scrollY
    const restore = () => {
      if (window.scrollX !== savedX || window.scrollY !== savedY) window.scrollTo(savedX, savedY)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const onFocusOut = () => {
      clearTimeout(timer)
      // Moving to another field in the pop-up keeps the keyboard up.
      timer = setTimeout(() => {
        const active = document.activeElement
        if (!(active && node.contains(active) && active.matches(TEXT_FIELD))) restore()
      }, 100)
    }
    const viewport = window.visualViewport
    let lastHeight = viewport?.height ?? 0
    const onViewportResize = () => {
      if (!viewport) return
      // Grew by a keyboard's worth: the keyboard just closed.
      if (viewport.height > lastHeight + 100) restore()
      lastHeight = viewport.height
    }
    node.addEventListener("focusout", onFocusOut)
    viewport?.addEventListener("resize", onViewportResize)
    return () => {
      clearTimeout(timer)
      node.removeEventListener("focusout", onFocusOut)
      viewport?.removeEventListener("resize", onViewportResize)
    }
  }, [node])
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const [node, setNode] = React.useState<HTMLDivElement | null>(null)
  useKeyboardScrollRestore(node)
  const setRefs = React.useCallback(
    (el: HTMLDivElement | null) => {
      setNode(el)
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
    },
    [ref]
  )
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={setRefs}
      className={cn(
        // A frame that never scrolls, around a body that does. On phones:
        //  - the height is capped to the screen you can actually see (dvh
        //    leaves out the browser's bars; vh doesn't, so tall pop-ups ran
        //    under them and their buttons couldn't be reached);
        //  - the X sits on the frame, so it stays put when the body scrolls
        //    (it used to scroll away with the content).
        "fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {/* The single minmax(0,1fr) column stops wide content (date and time
          boxes) from pushing the pop-up past the screen edge. */}
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto p-6">
        {children}
      </div>
      {/* A 44px tap target: the bare 16px icon was nearly impossible to hit on a phone. */}
      <DialogPrimitive.Close className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-80 ring-offset-background transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // px-8 keeps a centred title clear of the close button.
      "flex flex-col space-y-1.5 px-8 text-center sm:pl-0 sm:pr-8 sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
