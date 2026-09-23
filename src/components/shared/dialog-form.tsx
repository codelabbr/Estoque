"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { NativeSelect } from "@/components/shared/native-select";
import { FormError } from "@/components/shared/form-alert";
import type { ActionResult } from "@/lib/actions";

export type DialogField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  placeholder?: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
};

/**
 * Formulário curto em diálogo (cargo, setor, tamanho...). A validação oficial é
 * o schema Zod da server action; os erros por campo voltam em `fieldErrors`.
 */
export function DialogForm({
  trigger,
  title,
  description,
  fields,
  submitLabel,
  successMessage,
  action,
  redirectTo,
  defaultOpen = false,
  onOpenChange,
}: {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
  title: string;
  description?: string;
  fields: DialogField[];
  submitLabel: string;
  successMessage: string;
  action: (
    values: Record<string, string>,
  ) => Promise<ActionResult<{ redirectTo?: string } | undefined | void>>;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpenState] = useState(defaultOpen);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      fields.map((f) => [f.name, String(data.get(f.name) ?? "")]),
    );
    setFormError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      toast.success(successMessage);
      setOpen(false);
      const target =
        (result.data && "redirectTo" in result.data
          ? result.data.redirectTo
          : undefined) ?? redirectTo;
      if (target) router.push(target);
      else router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setFormError(null);
          setFieldErrors({});
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            {fields.map((field) => {
              const errors = fieldErrors[field.name];
              const id = `df-${field.name}`;
              return (
                <Field key={field.name} data-invalid={!!errors}>
                  <FieldLabel htmlFor={id}>
                    {field.label}
                    {!field.required && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        (opcional)
                      </span>
                    )}
                  </FieldLabel>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={id}
                      name={field.name}
                      defaultValue={field.defaultValue}
                      placeholder={field.placeholder}
                      aria-invalid={!!errors}
                    />
                  ) : field.type === "select" ? (
                    <NativeSelect
                      id={id}
                      name={field.name}
                      defaultValue={field.defaultValue ?? ""}
                      aria-invalid={!!errors}
                    >
                      {!field.required && <option value="">—</option>}
                      {field.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      id={id}
                      name={field.name}
                      type={field.type ?? "text"}
                      inputMode={field.inputMode}
                      defaultValue={field.defaultValue}
                      placeholder={field.placeholder}
                      aria-invalid={!!errors}
                    />
                  )}
                  {field.description && !errors && (
                    <FieldDescription>{field.description}</FieldDescription>
                  )}
                  <FieldError
                    errors={errors?.map((message) => ({ message }))}
                  />
                </Field>
              );
            })}
            <FormError
              message={
                formError && !Object.keys(fieldErrors).length ? formError : null
              }
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-full px-5 font-bold"
            >
              {isPending && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
