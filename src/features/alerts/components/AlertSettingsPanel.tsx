"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Panel, PanelHeader } from "@/components/shared/panel";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { DIGEST_GROUPS, type AlertSettings } from "@/features/alerts/digest";
import {
  saveAlertSettings,
  setMemberDailyDigest,
} from "@/features/alerts/settings-actions";

type Member = {
  userId: string;
  email: string;
  role: OrgRole;
  dailyDigest: boolean;
};

const TYPE_ROWS: {
  key: keyof AlertSettings;
  label: string;
  description: string;
}[] = [
  {
    key: "notify_new_irregulars",
    label: "Irregulares novos",
    description: "Funcionários que ficaram irregulares desde o último resumo",
  },
  ...DIGEST_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    description: g.description,
  })),
];

function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0 sm:px-5">
      <Label
        htmlFor={id}
        className="flex flex-col items-start gap-0.5 font-normal"
      >
        <span className="font-bold">{label}</span>
        <span className="text-muted-foreground text-sm">{description}</span>
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </li>
  );
}

export function AlertSettingsPanel({
  orgSlug,
  settings: initial,
  members: initialMembers,
  canEdit,
}: {
  orgSlug: string;
  settings: AlertSettings;
  members: Member[];
  canEdit: boolean;
}) {
  const [settings, setSettings] = useState(initial);
  const [members, setMembers] = useState(initialMembers);
  const [isPending, startTransition] = useTransition();

  function update(key: keyof AlertSettings, value: boolean) {
    const next = { ...settings, [key]: value };
    const previous = settings;
    setSettings(next);
    startTransition(async () => {
      const r = await saveAlertSettings(orgSlug, next);
      if (!r.ok) {
        setSettings(previous);
        toast.error(r.error);
      } else toast.success("Configuração salva");
    });
  }

  function toggleMember(userId: string, value: boolean) {
    setMembers((ms) =>
      ms.map((m) => (m.userId === userId ? { ...m, dailyDigest: value } : m)),
    );
    startTransition(async () => {
      const r = await setMemberDailyDigest(orgSlug, userId, value);
      if (!r.ok) {
        setMembers((ms) =>
          ms.map((m) =>
            m.userId === userId ? { ...m, dailyDigest: !value } : m,
          ),
        );
        toast.error(r.error);
      }
    });
  }

  const recipients = members.filter((m) => m.dailyDigest).length;
  const disabled = !canEdit || isPending;

  return (
    <>
      <Panel className="animate-fade-up">
        <PanelHeader
          title="Resumo diário por e-mail"
          description="Enviado às 7h (horário de Brasília), só quando houver algo novo."
        />
        <ul>
          <ToggleRow
            id="alerts-enabled"
            label="Enviar o resumo diário"
            description={
              settings.enabled
                ? `${recipients} ${recipients === 1 ? "destinatário" : "destinatários"}`
                : "Nenhum e-mail será enviado"
            }
            checked={settings.enabled}
            disabled={disabled}
            onChange={(v) => update("enabled", v)}
          />
        </ul>
        {settings.enabled && (
          <>
            <h3 className="text-muted-foreground border-t px-4 pt-4 pb-1 text-xs font-bold tracking-wide uppercase sm:px-5">
              O que entra no resumo
            </h3>
            <ul>
              {TYPE_ROWS.map((t) => (
                <ToggleRow
                  key={t.key}
                  id={`alerts-${t.key}`}
                  label={t.label}
                  description={t.description}
                  checked={settings[t.key]}
                  disabled={disabled}
                  onChange={(v) => update(t.key, v)}
                />
              ))}
            </ul>
          </>
        )}
        {!canEdit && (
          <p className="text-muted-foreground border-t px-4 py-3 text-sm sm:px-5">
            Só proprietários e administradores alteram estas configurações.
          </p>
        )}
      </Panel>

      {settings.enabled && (
        <Panel className="animate-fade-up">
          <PanelHeader
            title="Destinatários"
            description="Quem da equipe recebe o resumo. Cada pessoa também pode desligar para si em Alertas."
          />
          <ul>
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5"
              >
                <AvatarInitials name={m.email} className="size-9 text-xs" />
                <Label
                  htmlFor={`digest-${m.userId}`}
                  className="flex min-w-0 flex-1 flex-col items-start gap-0.5 font-normal"
                >
                  <span className="max-w-full truncate font-bold">
                    {m.email}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {ROLE_LABELS[m.role]}
                  </span>
                </Label>
                <Switch
                  id={`digest-${m.userId}`}
                  checked={m.dailyDigest}
                  disabled={disabled}
                  onCheckedChange={(v) => toggleMember(m.userId, v)}
                />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
