import streamlit as st
import pandas as pd
import plotly.express as px

st.set_page_config(
    page_title="AUDITOR PRO",
    page_icon="📋",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    /* Tema CLARO con contraste */
    .stApp {
        background: #f5f7fa;
    }
    
    /* Encabezados */
    h1, h2, h3, h4 {
        color: #1a1a2e !important;
        margin-bottom: 0.5rem !important;
        font-weight: 600;
    }
    
    /* Textos generales */
    .stMarkdown, p, div, span {
        color: #333333 !important;
    }
    
    /* Métricas */
    div[data-testid="stMetricValue"] {
        color: #0066cc !important;
        font-size: 20px !important;
        font-weight: bold;
    }
    div[data-testid="stMetricLabel"] {
        color: #555555 !important;
    }
    
    /* Sidebar */
    section[data-testid="stSidebar"] {
        background: #e8eef5;
    }
    
    /* Dataframes */
    .stDataFrame {
        background: #ffffff !important;
        border: 1px solid #ddd;
        border-radius: 8px;
    }
    
    /* Botones */
    .stButton > button {
        background: linear-gradient(135deg, #0066cc 0%, #004999 100%) !important;
        color: #ffffff !important;
        font-weight: bold;
        border-radius: 8px;
        border: none;
    }
    .stButton > button:hover {
        background: linear-gradient(135deg, #0052a3 0%, #003366 100%) !important;
    }
    
    /* Selectbox */
    div[data-baseweb="select"] > div {
        background: #ffffff !important;
        border: 1px solid #ccc !important;
    }
    
    /* Tabs */
    .stTabs [data-baseweb="tab"] {
        background: #e8eef5;
        color: #333;
        border-radius: 8px 8px 0px 0px;
    }
    .stTabs [aria-selected="true"] {
        background: #0066cc !important;
        color: #ffffff !important;
    }
    
    /* Expander */
    div[data-testid="stExpander"] {
        background: #ffffff;
        border: 1px solid #ddd;
        border-radius: 8px;
    }
    
    /* Tarjetas de estado */
    .valid-card {
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        padding: 15px;
        border-radius: 10px;
        text-align: center;
        border: 2px solid #28a745;
    }
    .invalid-card {
        background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
        padding: 15px;
        border-radius: 10px;
        text-align: center;
        border: 2px solid #dc3545;
    }
    .revision-card {
        background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
        padding: 15px;
        border-radius: 10px;
        text-align: center;
        border: 2px solid #ffc107;
    }
    .valid-card h2, .invalid-card h2, .revision-card h2 {
        color: #ffffff !important;
        margin: 0;
        font-size: 24px;
    }
    
    /* Alertas */
    .stAlert {
        background: #ffffff;
        border-left: 4px solid #0066cc;
    }
    
    /* Progreso */
    .stProgress > div > div {
        background: #0066cc;
    }
    
    /* Checkbox */
    div[data-testid="stCheckbox"] label {
        color: #333 !important;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #f1f1f1; }
    ::-webkit-scrollbar-thumb { background: #0066cc; border-radius: 4px; }
    
    /* Responsive */
    @media (max-width: 768px) {
        .block-container {
            padding: 0.5rem !important;
        }
        h1 { font-size: 1.3rem !important; }
        h2 { font-size: 1.1rem !important; }
    }
</style>
""", unsafe_allow_html=True)

# Materiales obligatorios
MATERIALES = {
    "CAJA": {"codigo": "70008001", "nombre": "CAJA INY CON TAPA"},
    "PRECINTO": {"codigo": "72002015", "nombre": "PRECINTO PARA MEDIDOR"},
    "MEDIDOR": {"codigo": "72003015", "nombre": "MEDIDOR DE AGUA"}
}

def validar_odt(odt_data):
    """Valida una ODT y retorna el estado y anomalías"""
    anomalias = []
    warnings = []
    
    # Verificar cada material obligatorio
    for nombre, info in MATERIALES.items():
        codigo = info["codigo"]
        material = odt_data[odt_data["Código Producto"].astype(str).str.contains(codigo, na=False)]
        
        if len(material) == 0:
            anomalias.append(f"Falta {nombre} ({codigo})")
            continue
        
        # Verificar cantidad = 1
        cantidad = material["Cantidad"].sum()
        if cantidad != 1:
            anomalias.append(f"{nombre} tiene cantidad {cantidad} (debe ser 1)")
        
        # Verificar serie para medidor
        if nombre == "MEDIDOR":
            series = material[material["Series"].notna()]
            if len(series) == 0:
                warnings.append(f"{nombre} sin número de serie")
    
    # Determinar estado
    if len(anomalias) == 0 and len(warnings) == 0:
        return "VALIDA", anomalias, warnings
    elif len(anomalias) > 0:
        return "REVISIÓN", anomalias, warnings
    else:
        return "ADVERTENCIA", anomalias, warnings

col_tit1, col_tit2 = st.columns([3, 1])
with col_tit1:
    st.markdown("## 🔍 AUDITOR PRO")
    st.caption("Sistema de Auditoría de ODTs")
with col_tit2:
    st.markdown("### v4.0")

st.markdown("---")

archivo = st.file_uploader("📁 Subir archivo Excel", type=["xlsx", "xls"])

if archivo:
    try:
        df = pd.read_excel(archivo, header=3)
        df = df.dropna(subset=["ODT"])
        
        col_cod = "Código Producto"
        col_desc = "Descripción Producto"
        col_cant = "Cantidad"
        col_odt = "ODT"
        col_cuadr = "Cuadrilla"
        col_fecha = "Fecha Consumo"
        
        # Analizar todas las ODTs
        resultados = []
        for odt in df[col_odt].unique():
            odt_data = df[df[col_odt] == odt]
            
            estado, anomalias, warnings = validar_odt(odt_data)
            
            # Verificar cada material
            precinto = odt_data[odt_data[col_cod].astype(str).str.contains("72002015", na=False)]
            medidor = odt_data[odt_data[col_cod].astype(str).str.contains("72003015", na=False)]
            caja = odt_data[odt_data[col_cod].astype(str).str.contains("70008001", na=False)]
            
            precinto_ok = len(precinto) > 0 and precinto["Cantidad"].sum() == 1
            medidor_ok = len(medidor) > 0 and medidor["Cantidad"].sum() == 1
            caja_ok = len(caja) > 0 and caja["Cantidad"].sum() == 1
            
            try:
                fecha = pd.to_datetime(odt_data[col_fecha].iloc[0]).strftime("%d/%m/%Y")
            except:
                fecha = str(odt_data[col_fecha].iloc[0])
            
            resultados.append({
                "ODT": odt,
                "Cuadrilla": str(odt_data[col_cuadr].iloc[0]),
                "Fecha": fecha,
                "Precinto": "✓" if precinto_ok else "✗",
                "Medidor": "✓" if medidor_ok else "✗",
                "Caja": "✓" if caja_ok else "✗",
                "Serie Medidor": "✓" if (len(medidor) > 0 and len(medidor[medidor["Series"].notna()]) > 0) else "✗",
                "Estado": estado,
                "Anomalías": "; ".join(anomalias) if anomalias else "Ninguna",
                "Warnings": "; ".join(warnings) if warnings else "Ninguno"
            })
        
        df_resultados = pd.DataFrame(resultados)
        
        # Sidebar filtros
        with st.sidebar:
            st.header("⚙️ Filtros")
            
            filtro_estado = st.selectbox("Estado", ["Todos", "VALIDA", "REVISIÓN", "ADVERTENCIA"])
            filtro_cuadrilla = st.selectbox("Cuadrilla", ["Todas"] + sorted(df_resultados["Cuadrilla"].unique().tolist()))
            
            df_filtrada = df_resultados.copy()
            if filtro_estado != "Todos":
                df_filtrada = df_filtrada[df_filtrada["Estado"] == filtro_estado]
            if filtro_cuadrilla != "Todas":
                df_filtrada = df_filtrada[df_filtrada["Cuadrilla"] == filtro_cuadrilla]
            
            st.markdown("---")
            st.header("📊 Resumen")
            st.metric("Total ODTs", len(df_resultados))
            st.metric("✅ Válidas", len(df_resultados[df_resultados["Estado"] == "VALIDA"]))
            st.metric("⚠️ Revisión", len(df_resultados[df_resultados["Estado"] == "REVISIÓN"]))
            st.metric("⚡ Advertencia", len(df_resultados[df_resultados["Estado"] == "ADVERTENCIA"]))
        
        # Tabs
        tab1, tab2, tab3 = st.tabs(["📋 Auditoría por ODT", "📊 Dashboard", "📋 Resumen"])
        
        with tab1:
            # Filtro rápido - todo en una fila
            c_filtro1, c_filtro2 = st.columns([2, 1])
            with c_filtro1:
                filtro_tab1 = st.selectbox("Filtrar por Estado", ["Todas", "VALIDA", "REVISIÓN", "ADVERTENCIA"])
            with c_filtro2:
                df_tab1 = df_resultados.copy()
                if filtro_tab1 != "Todas":
                    df_tab1 = df_tab1[df_tab1["Estado"] == filtro_tab1]
                st.metric(f"Total", len(df_tab1))
            
            # Selector de ODT
            odts_lista = sorted(df_tab1["ODT"].unique().tolist())
            
            if len(odts_lista) == 0:
                st.warning("No hay ODTs con este filtro")
            else:
                odt_seleccionada = st.selectbox("🔍 Seleccionar ODT", odts_lista)
                
                if odt_seleccionada:
                    odt_data = df[df[col_odt].astype(str) == str(odt_seleccionada)]
                    resultado = df_tab1[df_tab1["ODT"] == odt_seleccionada].iloc[0]
                    
                    # Fila 1: Estado compacto
                    col_estado1, col_estado2, col_estado3 = st.columns([1, 1, 1])
                    
                    with col_estado1:
                        if resultado["Estado"] == "VALIDA":
                            st.success("✅ VÁLIDA")
                        elif resultado["Estado"] == "REVISIÓN":
                            st.warning("⚠️ REVISIÓN")
                        else:
                            st.error("⚡ ADVERTENCIA")
                        st.caption(f"{resultado['Cuadrilla']} - {resultado['Fecha']}")
                    
                    with col_estado2:
                        st.write("**Obligatorios:**")
                        p = "✅" if resultado['Precinto'] == '✓' else "❌"
                        m = "✅" if resultado['Medidor'] == '✓' else "❌"
                        c = "✅" if resultado['Caja'] == '✓' else "❌"
                        st.write(f"{p} Precinto | {m} Medidor | {c} Caja")
                    
                    with col_estado3:
                        s = "✅" if resultado['Serie Medidor'] == '✓' else "⚠️"
                        st.write(f"**Serie:** {s}")
                        if resultado["Anomalías"] != "Ninguna":
                            st.caption(f"⚠️ {resultado['Anomalías'][:50]}...")
                    
                    # Fila 2: Tabla materiales con verificación
                    st.markdown("### 📦 Materiales")
                    
                    materiales_tabla = odt_data[[col_cod, col_desc, col_cant, "Unidad", "Series"]].copy()
                    
                    # Reordenar columnas: Código, Descripción, Verificado, Cantidad, Unidad, Serie
                    materiales_tabla = materiales_tabla[[col_cod, col_desc, col_cant, "Unidad", "Series"]]
                    materiales_tabla.insert(2, "Verificado", False)
                    
                    # Usar data_editor para permitir checkboxes
                    edited_df = st.data_editor(
                        materiales_tabla,
                        column_config={
                            "Verificado": st.column_config.CheckboxColumn(
                                "Verificado",
                                help="Marcar si se verificó en campo",
                                default=False,
                            )
                        },
                        use_container_width=True,
                        hide_index=True,
                        height=180,
                        disabled=["Código Producto", "Descripción Producto", "Cantidad", "Unidad", "Series"]
                    )
                    
                    # Contar verificados
                    verificados = edited_df["Verificado"].sum()
                    total = len(edited_df)
                    if verificados > 0:
                        st.success(f"✓ {verificados}/{total} materiales verificados")
        
        with tab2:
            c1, c2, c3, c4 = st.columns(4)
            with c1: st.metric("Total ODTs", len(df_resultados))
            with c2: st.metric("✅ Válidas", len(df_resultados[df_resultados["Estado"] == "VALIDA"]))
            with c3: st.metric("⚠️ Revisión", len(df_resultados[df_resultados["Estado"] == "REVISIÓN"]))
            with c4: st.metric("⚡ Advertencia", len(df_resultados[df_resultados["Estado"] == "ADVERTENCIA"]))
            
            col_g1, col_g2 = st.columns(2)
            
            with col_g1:
                st.markdown("### 📈 Estado de ODTs")
                estado_counts = df_resultados["Estado"].value_counts()
                fig_pie = px.pie(
                    values=estado_counts.values, 
                    names=estado_counts.index,
                    color=estado_counts.index,
                    color_discrete_map={"VALIDA": "#00E676", "REVISIÓN": "#FFC107", "ADVERTENCIA": "#FF9800"},
                    hole=0.4
                )
                fig_pie.update_layout(paper_bgcolor="rgba(0,0,0,0)", font_color="#B8B8B8")
                st.plotly_chart(fig_pie, use_container_width=True)
            
            with col_g2:
                st.markdown("### 👥 ODTs por Cuadrilla")
                cuadrilla_estado = df_resultados.groupby(["Cuadrilla", "Estado"]).size().unstack(fill_value=0)
                fig_bar = px.bar(cuadrilla_estado, barmode="group",
                               color_discrete_map={"VALIDA": "#00E676", "REVISIÓN": "#FFC107", "ADVERTENCIA": "#FF9800"})
                fig_bar.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font_color="#B8B8B8")
                st.plotly_chart(fig_bar, use_container_width=True)
            
            st.markdown("### 📊 Materiales Más Usados")
            mat_usados = df.groupby(col_desc)[col_cant].sum().reset_index().sort_values(col_cant, ascending=False).head(10)
            fig_bar2 = px.bar(mat_usados, x=col_desc, y=col_cant, color=col_cant, color_continuous_scale="Teal")
            fig_bar2.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font_color="#B8B8B8", xaxis_title="")
            st.plotly_chart(fig_bar2, use_container_width=True)
        
        with tab3:
            st.markdown("### 📋 Resumen de Auditoría")
            
            # Resaltar filas según estado
            def highlight_estado(row):
                if row["Estado"] == "VALIDA":
                    return ["background-color: rgba(0,230,118,0.2)"] * len(row)
                elif row["Estado"] == "REVISIÓN":
                    return ["background-color: rgba(255,193,7,0.2)"] * len(row)
                else:
                    return ["background-color: rgba(255,152,0,0.2)"] * len(row)
            
            st.dataframe(
                df_filtrada[["ODT", "Cuadrilla", "Fecha", "Precinto", "Medidor", "Caja", "Serie Medidor", "Estado", "Anomalías"]],
                use_container_width=True,
                hide_index=True,
                height=400
            )
            
            csv = df_filtrada.to_csv(index=False).encode('utf-8')
            st.download_button("📥 Exportar CSV", csv, "auditoria_odt.csv", "text/csv")
    
    except Exception as e:
        st.error(f"❌ Error: {str(e)}")

else:
    st.markdown("""
    <div style="text-align: center; padding: 80px 20px;">
        <h2 style="color: #888;">📁 Subí tu archivo Excel</h2>
    </div>
    """, unsafe_allow_html=True)
