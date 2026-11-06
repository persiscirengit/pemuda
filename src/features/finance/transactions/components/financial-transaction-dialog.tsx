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
import type { FinancialCategory } from "@/db/schema/finance";
import {
  createTransactionAction,
  updateTransactionAction,
} from "@/features/finance/transactions/actions";
import type { TransactionWithDetails } from "@/server/dal/finance/transactions";

const formSchema = z.object({
  type: z.enum(["income", "expense"]),
  financialCategoryId: z.string().min(1),
  amountIdr: z.number().int().positive(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  paymentMethod: z.enum(["cash", "transfer", "other"]),
  referenceNo: z.string().max(100).optional(),
  receiptAttachment: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface FinancialTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionWithDetails | null;
  categories: FinancialCategory[];
  defaultType?: "income" | "expense";
  onSuccess?: () => void;
}

export function FinancialTransactionDialog({
  open,
  onOpenChange,
  transaction,
  categories,
  defaultType = "income",
  onSuccess,
}: FinancialTransactionDialogProps) {
  const t = useTranslations("finance");
  const isEditing = !!transaction;

  const todayStr = React.useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: defaultType,
      financialCategoryId: "",
      amountIdr: 0,
      transactionDate: todayStr,
      title: "",
      description: "",
      paymentMethod: "cash",
      referenceNo: "",
      receiptAttachment: "",
    },
  });

  const selectedType = watch("type");

  const filteredCategories = React.useMemo(() => {
    return categories.filter((c) => c.type === selectedType && c.isActive);
  }, [categories, selectedType]);

  React.useEffect(() => {
    if (transaction) {
      const dateStr =
        typeof transaction.transactionDate === "string"
          ? transaction.transactionDate
          : new Date(transaction.transactionDate).toISOString().slice(0, 10);

      reset({
        type: transaction.type,
        financialCategoryId: transaction.financialCategoryId,
        amountIdr: Number(transaction.amountIdr),
        transactionDate: dateStr,
        title: transaction.title,
        description: transaction.description ?? "",
        paymentMethod: transaction.paymentMethod ?? "cash",
        referenceNo: transaction.referenceNo ?? "",
        receiptAttachment: transaction.referenceNo?.startsWith("uploads/")
          ? transaction.referenceNo
          : "",
      });
    } else {
      reset({
        type: defaultType,
        financialCategoryId: filteredCategories[0]?.id ?? "",
        amountIdr: 0,
        transactionDate: todayStr,
        title: "",
        description: "",
        paymentMethod: "cash",
        referenceNo: "",
        receiptAttachment: "",
      });
    }
  }, [transaction, reset, defaultType, filteredCategories, todayStr]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && transaction) {
        const res = await updateTransactionAction({
          id: transaction.id,
          ...values,
          description: values.description || null,
          referenceNo: values.referenceNo || null,
          receiptAttachment: values.receiptAttachment || null,
        });

        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }

        toast.success(t("successTransactionUpdated"));
      } else {
        const res = await createTransactionAction({
          ...values,
          description: values.description || null,
          referenceNo: values.referenceNo || null,
          receiptAttachment: values.receiptAttachment || null,
        });

        if (res?.serverError) {
          toast.error(res.serverError);
          return;
        }

        toast.success(t("successTransactionCreated"));
      }

      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error(t("errorTransactionSave"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editTransaction") : t("addTransaction")}
          </DialogTitle>
          <DialogDescription>{t("transactionsDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("type")}</FieldLabel>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue("financialCategoryId", "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("type")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">{t("income")}</SelectItem>
                      <SelectItem value="expense">{t("expense")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && <FieldError>{errors.type.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>{t("category")}</FieldLabel>
              <Controller
                name="financialCategoryId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={filteredCategories.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.financialCategoryId && (
                <FieldError>{errors.financialCategoryId.message}</FieldError>
              )}
            </Field>
          </FieldGroup>

          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("amount")}</FieldLabel>
              <Controller
                name="amountIdr"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t("amountPlaceholder")}
                    value={field.value || ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                  />
                )}
              />
              {errors.amountIdr && (
                <FieldError>{errors.amountIdr.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel>{t("transactionDate")}</FieldLabel>
              <Controller
                name="transactionDate"
                control={control}
                render={({ field }) => (
                  <Input
                    type="date"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.transactionDate && (
                <FieldError>{errors.transactionDate.message}</FieldError>
              )}
            </Field>
          </FieldGroup>

          <Field>
            <FieldLabel>{t("title")}</FieldLabel>
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <Input placeholder={t("titlePlaceholder")} {...field} />
              )}
            />
            {errors.title && <FieldError>{errors.title.message}</FieldError>}
          </Field>

          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("paymentMethod")}</FieldLabel>
              <Controller
                name="paymentMethod"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("paymentMethod")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("cash")}</SelectItem>
                      <SelectItem value="transfer">{t("transfer")}</SelectItem>
                      <SelectItem value="other">{t("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.paymentMethod && (
                <FieldError>{errors.paymentMethod.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel>{t("referenceNo")}</FieldLabel>
              <Controller
                name="referenceNo"
                control={control}
                render={({ field }) => (
                  <Input
                    placeholder={t("referenceNoPlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.referenceNo && (
                <FieldError>{errors.referenceNo.message}</FieldError>
              )}
            </Field>
          </FieldGroup>

          <Field>
            <FieldLabel>{t("notes")}</FieldLabel>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Textarea
                  placeholder={t("notesPlaceholder")}
                  rows={2}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.description && (
              <FieldError>{errors.description.message}</FieldError>
            )}
          </Field>

          <DialogFooter className="pt-2">
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
