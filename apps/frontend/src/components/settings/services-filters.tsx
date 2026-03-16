"use client";

import type { Professional } from "@talora/shared";
import { ArrowUpDown, Loader2, Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ServicesFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (value: "all" | "active" | "inactive") => void;
  professionalFilter: string;
  onProfessionalFilterChange: (value: string) => void;
  sortBy: "name" | "price_asc" | "price_desc" | "duration";
  onSortChange: (value: "name" | "price_asc" | "price_desc" | "duration") => void;
  professionals: Professional[];
  onCreateClick: () => void;
  onImportClick: () => void;
  isPreviewing: boolean;
}

export function ServicesFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  professionalFilter,
  onProfessionalFilterChange,
  sortBy,
  onSortChange,
  professionals,
  onCreateClick,
  onImportClick,
  isPreviewing,
}: ServicesFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        onClick={onCreateClick}
        className="h-11 rounded-2xl bg-slate-900 px-5 text-white hover:bg-slate-800"
      >
        <Plus className="mr-2 h-4 w-4" />
        Nuevo servicio
      </Button>

      <Button
        variant="outline"
        onClick={onImportClick}
        className="h-11 rounded-2xl border-[#d8cdb8] bg-white px-4 hover:bg-[#f8f2e9]"
      >
        {isPreviewing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Importar CSV
      </Button>

      <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as typeof statusFilter)}>
        <SelectTrigger className="h-11 w-auto min-w-[140px] rounded-2xl border-[#dde1ea] bg-white">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="inactive">Inactivos</SelectItem>
        </SelectContent>
      </Select>

      {professionals.length > 0 && (
        <Select value={professionalFilter} onValueChange={onProfessionalFilterChange}>
          <SelectTrigger className="h-11 w-auto min-w-[180px] rounded-2xl border-[#dde1ea] bg-white">
            <SelectValue placeholder="Todos los profesionales" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los profesionales</SelectItem>
            {professionals.map((prof) => (
              <SelectItem key={prof.id} value={prof.id}>
                {prof.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={sortBy} onValueChange={(v) => onSortChange(v as typeof sortBy)}>
        <SelectTrigger className="h-11 w-auto min-w-[160px] rounded-2xl border-[#dde1ea] bg-white">
          <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-slate-400" />
          <SelectValue placeholder="Nombre A-Z" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Nombre A-Z</SelectItem>
          <SelectItem value="price_asc">Precio menor</SelectItem>
          <SelectItem value="price_desc">Precio mayor</SelectItem>
          <SelectItem value="duration">Duracion</SelectItem>
        </SelectContent>
      </Select>

      <div className="relative ml-auto w-full min-w-0 sm:w-[320px]">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar servicio..."
          className="h-11 rounded-2xl border-[#dde1ea] bg-white pl-11 shadow-none"
        />
      </div>
    </div>
  );
}
