"use client";

import { useActionData, useFetcher } from "@remix-run/react";
import { getFormProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Status } from "@prisma/client";
import { useEffect, useState } from "react";

const carSchema = z.object({
  make: z
    .string({
      required_error: "Make is required.",
    })
    .min(1),
  model: z
    .string({
      required_error: "Model is required.",
    })
    .min(1),
  year: z
    .number({
      required_error: "Year is required.",
    })
    .int()
    .min(2000, "Year must be 2000 or later")
    .max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  price: z
    .number({
      required_error: "Price is required.",
    })
    .positive("Price must be positive"),
  status: z.nativeEnum(Status, {
    required_error: "Status is required.",
  }),
});

export function SheetDemo() {
  const actionData = useActionData();

  console.log("actionData", actionData);

  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);
  const [form, { make, model, year, price, status }] = useForm({
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carSchema });
    },
    shouldRevalidate: "onBlur",
    // onSubmit(e, { formData }) {
    //   console.log("onSubmit", formData);
    //   //   e.preventDefault();
    //   fetcher.submit(formData, {
    //     method: "POST",
    //     action: "/fleet-owner/cars/new",
    //   });
    // },
  });

  //   const handleSubmit = (e: React.FormEvent) => {
  //     const result = form.validate();
  //     if (result.error) {
  //       e.preventDefault();
  //     }
  //   };

  useEffect(() => {
    console.log("before", fetcher);
    // && fetcher.data && fetcher.data.success
    if (fetcher.state === "loading" && fetcher.data && fetcher.data.success) {
      console.log("do we get here?", fetcher, open);
      //   console.log("after", fetcher);
      //   form.reset();
      setOpen(false);

      return;
    }
  }, [fetcher.data, form, fetcher.state]);

  return (
    <Sheet
      //   defaultOpen={true}
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          if (fetcher.state === "idle") {
            form.reset();
          }
          setOpen(newOpen);
        } else {
          setOpen(newOpen);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline">Add New Car</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add New Car</SheetTitle>
          <SheetDescription>
            Enter the details of the new car below.
          </SheetDescription>
        </SheetHeader>
        <fetcher.Form
          method="post"
          {...getFormProps(form)}
          //   onSubmit={handleSubmit}

          action="/fleet-owner/cars/new"
        >
          <div className="mb-4">
            <Label htmlFor={make.id}>Make</Label>
            <Input id={make.id} name={make.name} className="w-full" />
            {make.errors && (
              <p className="text-red-500 text-sm mt-1">{make.errors}</p>
            )}
          </div>

          <div className="mb-4">
            <Label htmlFor={model.id}>Model</Label>
            <Input id={model.id} name={model.name} className="w-full" />
            {model.errors && (
              <p className="text-red-500 text-sm mt-1">{model.errors}</p>
            )}
          </div>

          <div className="mb-4">
            <Label htmlFor={year.id}>Year</Label>
            <Input
              id={year.id}
              name={year.name}
              type="number"
              className="w-full"
            />
            {year.errors && (
              <p className="text-red-500 text-sm mt-1">{year.errors}</p>
            )}
          </div>

          <div className="mb-4">
            <Label htmlFor={price.id}>Price</Label>
            <Input
              id={price.id}
              name={price.name}
              type="number"
              step="0.01"
              className="w-full"
            />
            {price.errors && (
              <p className="text-red-500 text-sm mt-1">{price.errors}</p>
            )}
          </div>

          <div className="mb-4">
            <Label htmlFor={status.id}>Status</Label>
            <Select name={status.name}>
              <SelectTrigger id={status.id} className="w-full">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(Status)
                  .filter((s) => s !== "BOOKED")
                  .map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {status.errors && (
              <p className="text-red-500 text-sm mt-1">{status.errors}</p>
            )}
          </div>

          <SheetFooter>
            <Button type="submit" disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? "Saving..." : "Save changes"}
            </Button>
          </SheetFooter>
        </fetcher.Form>
      </SheetContent>
    </Sheet>
  );
}
