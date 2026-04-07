import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GuestAccountProps {
  onPasswordChange: (password: string | null) => void;
}

export function GuestAccount({ onPasswordChange }: GuestAccountProps) {
  const { t } = useTranslation();
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");

  function handleToggle(checked: boolean) {
    setCreateAccount(checked);
    if (!checked) {
      setPassword("");
      onPasswordChange(null);
    }
  }

  function handlePasswordChange(val: string) {
    setPassword(val);
    onPasswordChange(val || null);
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={createAccount}
          onCheckedChange={(v) => handleToggle(v === true)}
        />
        <span className="text-sm font-medium">
          {t("checkout.createAccountLabel")}
        </span>
      </label>

      {createAccount && (
        <div>
          <Label htmlFor="checkout-password">{t("auth.password")}</Label>
          <Input
            id="checkout-password"
            type="password"
            placeholder={t("checkout.createPasswordPlaceholder")}
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t("checkout.accountEmailNote")}
          </p>
        </div>
      )}
    </div>
  );
}
