export default function RightSidePanel() {
  return (
    <SidePanel
      side="right"
      title="Gdańsk Housing"
      subtitle="PLATFORMA ANALITYCZNA"
      width={560}
    >
      <button type="button" className={styles.chip}>
        Zaloguj
      </button>
      <button
        className={stylesSidePanel.chip}
        type="button"
        onClick={onChangeCity}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hovered ? "Zmień miasto" : cities[selectedCityIdx].name}
      </button>
      <div className={stylesSidePanel.chips}>
        <button className={stylesSidePanel.chip}>Wszystkie</button>
        <button className={stylesSidePanel.chip}>Ciche Strefy</button>
        <button
          className={`${stylesSidePanel.chip} ${stylesSidePanel.chipActive}`}
        >
          Budżet &lt; 3500
        </button>
      </div>

      <div className={stylesSidePanel.empty}>
        <div>
          <div className={stylesSidePanel.emptyIcon}>🏢</div>
          <div className={stylesSidePanel.emptyText}>
            Wybierz budynek na mapie,
            <br />
            aby pobrać dane.
          </div>
        </div>
      </div>
    </SidePanel>
  );
}