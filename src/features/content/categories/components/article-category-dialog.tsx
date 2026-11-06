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
import { Textarea } from "@/components/ui/textarea";
import type { ArticleCategory } from "@/db/schema/content";
import {
  createArticleCategoryAction,
  updateArticleCategoryAction,
} from "@/features/content/categories/actions";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().max(120).optional(),
  description: z.string().optional(),
  color: z.string().max(30).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export interface ArticleCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: ArticleCategory | null;
  onSuccess?: () => void;
}

export function ArticleCategoryDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: ArticleCategoryDialogProps) {
  const t = useTranslations("articles");
  const isEditing = !!category;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      color: "#059669",
      sortOrder: 1,
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
        color: category.color || "#059669",
        sortOrder: category.sortOrder ?? 1,
        isActive: category.isActive,
      });
    } else {
      reset({
        name: "",
        slug: "",
        description: "",
        color: "#059669",
        sortOrder: 1,
        isActive: true,
      });
    }
  }, [category, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && category) {
        const res = await updateArticleCategoryAction({
          id: category.id,
          name: values.name,
          slug: values.slug || undefined,
          description: values.description || null,
          color: values.color || null,
          sortOrder: values.sortOrder ?? null,
          isActive: values.isActive,
        });

        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }

        toast.success(t("successUpdated"));
      } else {
        const res = await createArticleCategoryAction({
          name: values.name,
          slug: values.slug || undefined,
          description: values.description || null,
          color: values.color || null,
          sortOrder: values.sortOrder ?? null,
          isActive: values.isActive,
        });

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

  const dialogTitle = isEditing ? t("editCategory") : t("addCategory");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{t("categoriesDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.name}>
                  <FieldLabel>{t("name")}</FieldLabel>
                  <Input {...field} placeholder={t("namePlaceholder")} />
                  {errors.name && (
                    <FieldError>{errors.name.message}</FieldError>
                  )}
                </Field>
              )}
            />

            <Controller
              name="slug"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.slug}>
                  <FieldLabel>{t("slug")}</FieldLabel>
                  <Input {...field} placeholder={t("slugPlaceholder")} />
                  {errors.slug && (
                    <FieldError>{errors.slug.message}</FieldError>
                  )}
                </Field>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="color"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.color}>
                    <FieldLabel>{t("color")}</FieldLabel>
                    <Input {...field} placeholder={t("colorPlaceholder")} />
                    {errors.color && (
                      <FieldError>{errors.color.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="sortOrder"
                control={control}
                render={({ field }) => (
                  <Field data-invalid={!!errors.sortOrder}>
                    <FieldLabel>{t("sortOrder")}</FieldLabel>
                    <Input
                      type="number"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? undefined
                            : Number.parseInt(e.target.value, 10),
                        )
                      }
                      placeholder={t("sortOrderPlaceholder")}
                    />
                    {errors.sortOrder && (
                      <FieldError>{errors.sortOrder.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Field data-invalid={!!errors.description}>
                  <FieldLabel>{t("description")}</FieldLabel>
                  <Textarea
                    {...field}
                    placeholder={t("descriptionPlaceholder")}
                    rows={3}
                  />
                  {errors.description && (
                    <FieldError>{errors.description.message}</FieldError>
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
