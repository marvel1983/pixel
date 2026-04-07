import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface BillingData {
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  address: string;
  zip: string;
  vatNumber?: string;
}

interface BillingFormProps {
  data: BillingData;
  errors: Partial<Record<keyof BillingData, string>>;
  onChange: (field: keyof BillingData, value: string) => void;
  showVatField?: boolean;
}

const COUNTRIES: [string, string][] = [
  ["US", "United States"], ["GB", "United Kingdom"], ["DE", "Germany"],
  ["FR", "France"], ["CA", "Canada"], ["AU", "Australia"],
  ["NL", "Netherlands"], ["PL", "Poland"], ["BR", "Brazil"],
  ["TR", "Turkey"], ["ES", "Spain"], ["IT", "Italy"],
  ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"],
  ["JP", "Japan"], ["KR", "South Korea"], ["IN", "India"],
  ["MX", "Mexico"], ["CH", "Switzerland"], ["AT", "Austria"],
  ["BE", "Belgium"], ["BG", "Bulgaria"], ["HR", "Croatia"],
  ["CY", "Cyprus"], ["CZ", "Czech Republic"], ["EE", "Estonia"],
  ["FI", "Finland"], ["GR", "Greece"], ["HU", "Hungary"],
  ["IE", "Ireland"], ["LV", "Latvia"], ["LT", "Lithuania"],
  ["LU", "Luxembourg"], ["MT", "Malta"], ["PT", "Portugal"],
  ["RO", "Romania"], ["SK", "Slovakia"], ["SI", "Slovenia"],
];

export function BillingForm({ data, errors, onChange, showVatField }: BillingFormProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Billing Details</h2>

      <div>
        <Label htmlFor="email">Email Address *</Label>
        <Input
          id="email"
          type="email"
          value={data.email}
          onChange={(e) => onChange("email", e.target.value)}
          className={errors.email ? "border-destructive" : ""}
        />
        {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={data.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            className={errors.firstName ? "border-destructive" : ""}
          />
          {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={data.lastName}
            onChange={(e) => onChange("lastName", e.target.value)}
            className={errors.lastName ? "border-destructive" : ""}
          />
          {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="country">Country *</Label>
        <Select value={data.country} onValueChange={(v) => onChange("country", v)}>
          <SelectTrigger className={errors.country ? "border-destructive" : ""}>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map(([code, name]) => (
              <SelectItem key={code} value={code}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.country && <p className="text-xs text-destructive mt-1">{errors.country}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={data.city}
            onChange={(e) => onChange("city", e.target.value)}
            className={errors.city ? "border-destructive" : ""}
          />
          {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
        </div>
        <div>
          <Label htmlFor="zip">Zip / Postal Code *</Label>
          <Input
            id="zip"
            value={data.zip}
            onChange={(e) => onChange("zip", e.target.value)}
            className={errors.zip ? "border-destructive" : ""}
          />
          {errors.zip && <p className="text-xs text-destructive mt-1">{errors.zip}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="address">Street Address *</Label>
        <Input
          id="address"
          value={data.address}
          onChange={(e) => onChange("address", e.target.value)}
          className={errors.address ? "border-destructive" : ""}
        />
        {errors.address && <p className="text-xs text-destructive mt-1">{errors.address}</p>}
      </div>

      {showVatField && (
        <div>
          <Label htmlFor="vatNumber">VAT Number (optional, for B2B tax exemption)</Label>
          <Input
            id="vatNumber"
            value={data.vatNumber ?? ""}
            onChange={(e) => onChange("vatNumber", e.target.value)}
            placeholder="e.g. DE123456789"
          />
        </div>
      )}
    </div>
  );
}
