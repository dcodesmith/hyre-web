import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { useFetcher } from "@remix-run/react";
import { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { z } from "zod";
import { useToast } from "~/hooks/use-toast";
import { SerializedChauffeur } from "~/types";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";

type EditChauffeurFormProps = {
  chauffeur: SerializedChauffeur;
  setIsEditOpen: Dispatch<SetStateAction<boolean>>;
};

const chauffeurSchema = z.object({
  name: z
    .string({
      required_error: "Name is required.",
    })
    .min(1),
  email: z
    .string({
      required_error: "Email is required.",
    })
    .email("Invalid email address"),
  phoneNumber: z
    .string({
      required_error: "Phone number is required.",
    })
    .min(11, "Phone number must be at least 11 digits"),
  address: z
    .string({
      required_error: "Address is required.",
    })
    .min(1),
});

interface DataTableRowActionsProps {
  row: Row<SerializedChauffeur>;
}

function EditChauffeurForm({ chauffeur, setIsEditOpen }: EditChauffeurFormProps) {
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const { toast } = useToast();

  console.log(chauffeur);
  const [form, { name, email, phoneNumber, address }] = useForm({
    id: "edit-chauffeur",
    defaultValue: {
      name: chauffeur.name,
      email: chauffeur.email,
      phoneNumber: chauffeur.phoneNumber,
      address: chauffeur.address,
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: chauffeurSchema });
    },
  });

  const isSubmitting = fetcher.state === "submitting";

  useEffect(() => {
    if (fetcher.data && !fetcher.data?.success) {
      setIsEditOpen(true);
    }

    if (fetcher.state === "idle" && fetcher.data?.success) {
      setIsEditOpen(false);
      toast({
        title: "Success",
        description: "Chauffeur was successfully updated",
        variant: "default",
      });
    }
  }, [fetcher.data, setIsEditOpen, fetcher.state, toast]);

  return (
    <fetcher.Form
      method="PUT"
      action={`/fleet-owner/chauffeurs`}
      {...getFormProps(form)}
      className="space-y-4"
    >
      {fetcher.data?.error && <p className="text-sm text-red-500">{fetcher.data.error}</p>}
      <div className="space-y-1">
        <Label htmlFor={name.id}>Name</Label>
        <Input readOnly {...getInputProps(name, { type: "text" })} />
        {name.errors && <p className="text-sm text-red-500">{name.errors}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={email.id}>Email</Label>
        <Input readOnly {...getInputProps(email, { type: "email" })} />
        {email.errors && <p className="text-sm text-red-500">{email.errors}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={phoneNumber.id}>Phone Number</Label>
        <Input {...getInputProps(phoneNumber, { type: "tel" })} />
        {phoneNumber.errors && <p className="text-sm text-red-500">{phoneNumber.errors}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={address.id}>Address</Label>
        <Input {...getInputProps(address, { type: "text" })} />
        {address.errors && <p className="text-sm text-red-500">{address.errors}</p>}
      </div>

      <input type="hidden" name="chauffeurId" value={chauffeur.id} />
      <input type="hidden" name="intent" value="edit" />

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Saving..." : "Save changes"}
      </Button>
    </fetcher.Form>
  );
}

export function ChauffeurRowActions({ row }: DataTableRowActionsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsEditOpen(true)}>Edit</DropdownMenuItem>

          <DropdownMenuItem>Suspend</DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem className="text-red-600">Archive</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-[400px] px-8">
          <SheetHeader>
            <SheetTitle>Edit Chauffeur</SheetTitle>
            <SheetDescription>
              Make changes to chauffeur details here. Click save when you&apos;re done.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <EditChauffeurForm chauffeur={row.original} setIsEditOpen={setIsEditOpen} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
