"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";

export function GalleryInteractive() {
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="demo-condition">Condition</Label>
          <Select>
            <SelectTrigger id="demo-condition">
              <SelectValue placeholder="Choose condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="LIKE_NEW">Like new</SelectItem>
              <SelectItem value="GOOD">Good</SelectItem>
              <SelectItem value="FAIR">Fair</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Confirm delivery?</DialogTitle>
            <DialogDescription>The seller will be paid once you confirm. You can&apos;t undo this.</DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button onClick={() => toast.success("Delivery confirmed")}>Confirm</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open filter sheet</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>On phones, filters open from the bottom of the screen.</SheetDescription>
          </SheetContent>
        </Sheet>
        <Button variant="secondary" onClick={() => toast.success("Listing saved")}>
          Show success toast
        </Button>
        <Button variant="secondary" onClick={() => toast.error("Couldn't upload photo. Check your connection.")}>
          Show error toast
        </Button>
      </div>
    </div>
  );
}
