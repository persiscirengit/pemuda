// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

afterEach(() => {
  cleanup();
});

import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef, TableFeatures } from "@tanstack/react-table";
import { Controller, useForm } from "react-hook-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { RtlWrapper } from "@/components/shared/rtl-wrapper";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

type FormValues = z.infer<typeof formSchema>;

function TestFormComponent({
  onSubmit,
}: {
  onSubmit: (data: FormValues) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "" },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="title-input">Title Label</FieldLabel>
            <Input id="title-input" {...field} />
            {fieldState.error && (
              <FieldError>{fieldState.error.message}</FieldError>
            )}
          </Field>
        )}
      />
      <Button type="submit">Submit</Button>
    </form>
  );
}

describe("Form System with Field and Controller", () => {
  it("displays labels and validation error messages on invalid submit", async () => {
    const handleSubmit = vi.fn();
    render(<TestFormComponent onSubmit={handleSubmit} />);

    expect(screen.getByText("Title Label")).toBeDefined();
    expect(screen.queryByText("Title is required")).toBeNull();

    const submitBtn = screen.getByText("Submit");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeDefined();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

interface SampleItem {
  id: string;
  name: string;
  score: number;
}

const sampleColumns: ColumnDef<TableFeatures, SampleItem, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "score",
    header: "Score",
  },
];

describe("DataTable Component", () => {
  it("renders empty state message when rows are empty", () => {
    render(
      <DataTable
        columns={sampleColumns}
        data={[]}
        emptyMessage="No entries found"
      />,
    );

    expect(screen.getByText("No entries found")).toBeDefined();
  });

  it("renders data rows and handles pagination state", () => {
    const items: SampleItem[] = [
      { id: "1", name: "Alpha", score: 10 },
      { id: "2", name: "Bravo", score: 20 },
      { id: "3", name: "Charlie", score: 30 },
    ];

    render(<DataTable columns={sampleColumns} data={items} pageSize={2} />);

    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Bravo")).toBeDefined();
    expect(screen.queryByText("Charlie")).toBeNull();

    const nextBtn = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText("Charlie")).toBeDefined();
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("handles sorting toggles on sortable headers", () => {
    const items: SampleItem[] = [
      { id: "1", name: "Beta", score: 5 },
      { id: "2", name: "Alpha", score: 25 },
    ];

    render(<DataTable columns={sampleColumns} data={items} />);

    const rowsBefore = screen.getAllByRole("row");
    // Row 0 is header, Row 1 is Beta, Row 2 is Alpha
    expect(rowsBefore[1]?.textContent).toContain("Beta");

    const nameHeader = screen.getByText("Name");
    fireEvent.click(nameHeader);

    const rowsAfter = screen.getAllByRole("row");
    expect(rowsAfter[1]?.textContent).toContain("Alpha");
  });
});

describe("ConfirmDialog Component", () => {
  it("renders dialog and emits confirm and cancel callbacks", () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={handleOpenChange}
        title="Delete Item"
        description="Are you sure you want to delete this item?"
        confirmLabel="Yes, Delete"
        cancelLabel="Dismiss"
        variant="destructive"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />,
    );

    expect(screen.getByText("Delete Item")).toBeDefined();
    expect(
      screen.getByText("Are you sure you want to delete this item?"),
    ).toBeDefined();

    const cancelBtn = screen.getByText("Dismiss");
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);

    const confirmBtn = screen.getByText("Yes, Delete");
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("RtlWrapper Component", () => {
  it("renders children and sets dir attribute correctly", () => {
    const { container: ltrContainer } = render(
      <RtlWrapper dir="ltr">
        <span>LTR Content</span>
      </RtlWrapper>,
    );
    expect(ltrContainer.firstElementChild?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("LTR Content")).toBeDefined();

    const { container: rtlContainer } = render(
      <RtlWrapper dir="rtl">
        <span>RTL Content</span>
      </RtlWrapper>,
    );
    expect(rtlContainer.firstElementChild?.getAttribute("dir")).toBe("rtl");
    expect(screen.getByText("RTL Content")).toBeDefined();
  });
});
