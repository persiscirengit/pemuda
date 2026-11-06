"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import type { Member } from "@/db/schema/organization";
import {
  createMemberAction,
  updateMemberAction,
} from "@/features/organization/members/actions";

const formSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(150),
  memberNumber: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(255).optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  birthDate: z.string().optional(),
  joinedAt: z.string().optional(),
  address: z.string().optional(),
  profilePhoto: z.string().optional(),
  memberStatus: z.enum(["active", "inactive", "alumni", "moved"]),
});

type FormValues = z.infer<typeof formSchema>;

export interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Member | null;
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
}

export function MemberDialog({
  open,
  onOpenChange,
  member,
  departments,
  positions,
  onSuccess,
}: MemberDialogProps) {
  const t = useTranslations("members");
  const isEditing = !!member;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      memberNumber: "",
      phone: "",
      email: "",
      departmentId: "",
      positionId: "",
      birthDate: "",
      joinedAt: "",
      address: "",
      profilePhoto: "",
      memberStatus: "active",
    },
  });

  React.useEffect(() => {
    if (member) {
      reset({
        fullName: member.fullName,
        memberNumber: member.memberNumber || "",
        phone: member.phone || "",
        email: member.email || "",
        departmentId: member.departmentId || "",
        positionId: member.positionId || "",
        birthDate: member.birthDate ? String(member.birthDate) : "",
        joinedAt: member.joinedAt ? String(member.joinedAt) : "",
        address: member.address || "",
        profilePhoto: member.profilePhoto || "",
        memberStatus: member.memberStatus,
      });
    } else {
      reset({
        fullName: "",
        memberNumber: "",
        phone: "",
        email: "",
        departmentId: "",
        positionId: "",
        birthDate: "",
        joinedAt: "",
        address: "",
        profilePhoto: "",
        memberStatus: "active",
      });
    }
  }, [member, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        fullName: values.fullName,
        memberNumber: values.memberNumber || null,
        phone: values.phone || null,
        email: values.email || null,
        departmentId: values.departmentId || null,
        positionId: values.positionId || null,
        birthDate: values.birthDate || null,
        joinedAt: values.joinedAt || null,
        address: values.address || null,
        profilePhoto: values.profilePhoto || null,
        memberStatus: values.memberStatus,
      };

      if (isEditing && member) {
        const res = await updateMemberAction({
          id: member.id,
          ...payload,
        });

        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }

        toast.success(t("successUpdated"));
      } else {
        const res = await createMemberAction(payload);

        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }

        toast.success(t("successCreated"));
      }

      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error(t("errorGeneric"));
    }
  };

  const dialogTitle = isEditing ? t("editMember") : t("addMember");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Controller
                name="fullName"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.fullName}>
                    <FieldLabel>{t("fullName")}</FieldLabel>
                    <Input {...field} placeholder={t("fullNamePlaceholder")} />
                    {errors.fullName && (
                      <FieldError>{errors.fullName.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="memberNumber"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.memberNumber}>
                    <FieldLabel>{t("memberNumber")}</FieldLabel>
                    <Input
                      {...field}
                      placeholder={t("memberNumberPlaceholder")}
                    />
                    {errors.memberNumber && (
                      <FieldError>{errors.memberNumber.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.phone}>
                    <FieldLabel>{t("phone")}</FieldLabel>
                    <Input {...field} placeholder={t("phonePlaceholder")} />
                    {errors.phone && (
                      <FieldError>{errors.phone.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.email}>
                    <FieldLabel>{t("email")}</FieldLabel>
                    <Input {...field} placeholder={t("emailPlaceholder")} />
                    {errors.email && (
                      <FieldError>{errors.email.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Controller
                name="birthDate"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.birthDate}>
                    <FieldLabel>{t("birthDate")}</FieldLabel>
                    <Input type="date" {...field} />
                    {errors.birthDate && (
                      <FieldError>{errors.birthDate.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="joinedAt"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.joinedAt}>
                    <FieldLabel>{t("joinedAt")}</FieldLabel>
                    <Input type="date" {...field} />
                    {errors.joinedAt && (
                      <FieldError>{errors.joinedAt.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.departmentId}>
                    <FieldLabel>{t("department")}</FieldLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) =>
                        field.onChange(val === "none" ? "" : val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("selectDepartment")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("noDepartment")}
                        </SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.departmentId && (
                      <FieldError>{errors.departmentId.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="positionId"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.positionId}>
                    <FieldLabel>{t("position")}</FieldLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) =>
                        field.onChange(val === "none" ? "" : val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("selectPosition")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noPosition")}</SelectItem>
                        {positions.map((pos) => (
                          <SelectItem key={pos.id} value={pos.id}>
                            {pos.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.positionId && (
                      <FieldError>{errors.positionId.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="address"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.address}>
                  <FieldLabel>{t("address")}</FieldLabel>
                  <Textarea
                    {...field}
                    placeholder={t("addressPlaceholder")}
                    rows={2}
                  />
                  {errors.address && (
                    <FieldError>{errors.address.message}</FieldError>
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
