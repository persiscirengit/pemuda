"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Department } from "@/db/schema/organization";
import {
  createDepartmentAction,
  updateDepartmentAction,
} from "../actions/departments";

export interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department | null;
  onSuccess?: () => void;
}

export function DepartmentDialog({
  open,
  onOpenChange,
  department,
  onSuccess,
}: DepartmentDialogProps) {
  const t = useTranslations("organization.departments");
  const tCommon = useTranslations("common");

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "inactive">("active");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (department) {
      setName(department.name);
      setDescription(department.description ?? "");
      setStatus(department.status);
    } else {
      setName("");
      setDescription("");
      setStatus("active");
    }
    setError(null);
  }, [department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("nameLabel"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (department) {
        const res = await updateDepartmentAction({
          id: department.id,
          name: name.trim(),
          description: description.trim() || null,
          status,
        });

        if (res?.serverError) {
          setError(res.serverError);
          toast.error(res.serverError);
          return;
        }

        toast.success(t("updatedSuccess"));
      } else {
        const res = await createDepartmentAction({
          name: name.trim(),
          description: description.trim() || null,
          status,
        });

        if (res?.serverError) {
          setError(res.serverError);
          toast.error(res.serverError);
          return;
        }

        toast.success(t("createdSuccess"));
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {department ? t("editDepartment") : t("createDepartment")}
            </DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>{t("nameLabel")}</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                disabled={isSubmitting}
                autoFocus
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>{t("descriptionLabel")}</FieldLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                disabled={isSubmitting}
                rows={3}
              />
            </Field>

            <Field>
              <FieldLabel>{t("statusLabel")}</FieldLabel>
              <Select
                value={status}
                onValueChange={(val: "active" | "inactive") => setStatus(val)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    {tCommon("status.active")}
                  </SelectItem>
                  <SelectItem value="inactive">
                    {tCommon("status.inactive")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {tCommon("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? tCommon("actions.saving")
                : tCommon("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
