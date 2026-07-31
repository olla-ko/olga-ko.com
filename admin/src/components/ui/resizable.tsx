import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "@/lib/utils";

export function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return <ResizablePrimitive.PanelGroup className={cn("flex h-full w-full", className)} {...props} />;
}

export const ResizablePanel = ResizablePrimitive.Panel;

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & { withHandle?: boolean }) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 hover:bg-ring data-[resize-handle-state=drag]:bg-ring",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-6 w-3.5 items-center justify-center rounded-sm border bg-background">
          <GripVertical className="h-3 w-3" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
}
