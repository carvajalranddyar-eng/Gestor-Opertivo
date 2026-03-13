export interface ODTData {
    ODT: string | number;
    "Código Producto": string | number;
    "Descripción Producto": string;
    Cantidad: number;
    Cuadrilla: string | number;
    "Descripción Cuadrilla": string;
    "Fecha Consumo": string | Date;
    "Hora Consumo"?: string;
    Series?: string;
    Unidad?: string;
    Motivo?: number;
    "Session ID"?: number;
}

export type MaterialStatus = "OK" | "CANTIDAD_INCORRECTA" | "MATERIAL_ERRONEO" | "FALTANTE" | "PENDIENTE";

export interface ODTMaterial extends ODTData {
    auditStatus: MaterialStatus;
    auditVerified: boolean;
    auditNotes?: string;
    isAutoValidated?: boolean;
    quantityAdjustment?: number;
    isManuallyAdded?: boolean;
    serieVerificada?: string;
    serieConfirmada?: boolean;
}

export interface AuditResult {
    ODT: string | number;
    Legajo: string | number;
    DescripcionCuadrilla: string;
    Fecha: string;
    Precinto: boolean;
    Medidor: boolean;
    Caja: boolean;
    SerieMedidor: boolean;
    Estado: "VALIDA" | "REVISIÓN" | "ADVERTENCIA";
    Anomalias: string[];
    Warnings: string[];
    Materiales: ODTMaterial[];
}

export const MATERIALES_OBLIGATORIOS = {
    CAJA: { codigo: "70008001", nombre: "CAJA INY CON TAPA" },
    PRECINTO: { codigo: "72002015", nombre: "PRECINTO PARA MEDIDOR" },
    MEDIDOR: { codigo: "72003015", nombre: "MEDIDOR DE AGUA" }
};

const MEDIDOR_CODE = MATERIALES_OBLIGATORIOS.MEDIDOR.codigo;

/** Sort materials: medidor always last, rest by code ascending */
export function sortMateriales(mats: ODTMaterial[]): ODTMaterial[] {
    return [...mats].sort((a, b) => {
        const aIsMed = String(a['Código Producto']).includes(MEDIDOR_CODE);
        const bIsMed = String(b['Código Producto']).includes(MEDIDOR_CODE);
        if (aIsMed && !bIsMed) return 1;
        if (!aIsMed && bIsMed) return -1;
        return String(a['Código Producto']).localeCompare(String(b['Código Producto']));
    });
}

export function validarODT(odtData: ODTData[]): AuditResult {
    const anomalias: string[] = [];
    const warnings: string[] = [];

    const getMaterial = (codigo: string) =>
        odtData.filter(m => String(m["Código Producto"]).includes(codigo));

    const items = {
        precinto: getMaterial(MATERIALES_OBLIGATORIOS.PRECINTO.codigo),
        medidor: getMaterial(MATERIALES_OBLIGATORIOS.MEDIDOR.codigo),
        caja: getMaterial(MATERIALES_OBLIGATORIOS.CAJA.codigo)
    };

    if (items.precinto.length === 0) {
        anomalias.push(`Falta PRECINTO (${MATERIALES_OBLIGATORIOS.PRECINTO.codigo})`);
    } else {
        const cant = items.precinto.reduce((s, i) => s + i.Cantidad, 0);
        if (cant !== 1) anomalias.push(`PRECINTO cantidad ${cant} (debe ser 1)`);
    }

    if (items.medidor.length === 0) {
        anomalias.push(`Falta MEDIDOR (${MATERIALES_OBLIGATORIOS.MEDIDOR.codigo})`);
    } else {
        const cant = items.medidor.reduce((s, i) => s + i.Cantidad, 0);
        if (cant !== 1) anomalias.push(`MEDIDOR cantidad ${cant} (debe ser 1)`);
        const tieneSerie = items.medidor.some(m => m.Series && String(m.Series).trim() !== "" && m.Series !== "N/A");
        if (!tieneSerie) warnings.push("MEDIDOR sin número de serie");
    }

    if (items.caja.length === 0) {
        anomalias.push(`Falta CAJA (${MATERIALES_OBLIGATORIOS.CAJA.codigo})`);
    } else {
        const cant = items.caja.reduce((s, i) => s + i.Cantidad, 0);
        if (cant !== 1) anomalias.push(`CAJA cantidad ${cant} (debe ser 1)`);
    }

    let estado: AuditResult["Estado"] = "VALIDA";
    if (anomalias.length > 0) estado = "REVISIÓN";
    else if (warnings.length > 0) estado = "ADVERTENCIA";

    const firstODT = odtData[0];
    const autoValidatedCodes = Object.values(MATERIALES_OBLIGATORIOS).map(m => m.codigo);

    const materiales: ODTMaterial[] = odtData.map(m => {
        const isAuto = autoValidatedCodes.some(code => String(m["Código Producto"]).includes(code));
        return {
            ...m,
            isAutoValidated: isAuto,
            auditStatus: isAuto ? "OK" : "PENDIENTE",
            auditVerified: isAuto,
            quantityAdjustment: 0,
        };
    });

    return {
        ODT: firstODT.ODT,
        Legajo: firstODT.Cuadrilla || "N/A",
        DescripcionCuadrilla: firstODT["Descripción Cuadrilla"] || "N/A",
        Fecha: String(firstODT["Fecha Consumo"] || "N/A"),
        Precinto: items.precinto.length > 0 && items.precinto.reduce((s, i) => s + i.Cantidad, 0) === 1,
        Medidor: items.medidor.length > 0 && items.medidor.reduce((s, i) => s + i.Cantidad, 0) === 1,
        Caja: items.caja.length > 0 && items.caja.reduce((s, i) => s + i.Cantidad, 0) === 1,
        SerieMedidor: items.medidor.some(m => m.Series && String(m.Series).trim() !== "" && m.Series !== "N/A"),
        Estado: estado,
        Anomalias: anomalias,
        Warnings: warnings,
        Materiales: sortMateriales(materiales)
    };
}

export type AuditResultEx = AuditResult & { odtNotes?: string; _uid?: string };
