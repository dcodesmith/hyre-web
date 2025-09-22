import type { Role, User } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ProfileForm } from "./ProfileForm";

interface ProfileFormProps {
  readonly onOpenChange: (open: boolean) => void;
  readonly user: (User & { roles: Pick<Role, "name">[] }) | null;
}

export function ProfileFormModal({ onOpenChange, user }: ProfileFormProps) {
  return (
    <Dialog defaultOpen={true} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Make changes to your profile here.</DialogDescription>
        </DialogHeader>

        <ProfileForm user={user} onCancel={() => onOpenChange(false)} cancelLabel="Close" />
      </DialogContent>
    </Dialog>
  );
}
