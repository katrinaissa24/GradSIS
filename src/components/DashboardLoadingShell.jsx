const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1100;

function SkeletonBlock({
  height,
  width = "100%",
  radius = 10,
  style,
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, rgba(226,232,240,0.8) 0%, rgba(241,245,249,1) 50%, rgba(226,232,240,0.8) 100%)",
        backgroundSize: "200% 100%",
        animation: "dashboard-skeleton-shimmer 1.2s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

export default function DashboardLoadingShell({
  isMobile,
  isTabletLayout,
}) {
  const resolvedIsMobile =
    typeof isMobile === "boolean"
      ? isMobile
      : typeof window !== "undefined"
        ? window.innerWidth <= MOBILE_BREAKPOINT
        : false;
  const resolvedIsTabletLayout =
    typeof isTabletLayout === "boolean"
      ? isTabletLayout
      : typeof window !== "undefined"
        ? window.innerWidth <= TABLET_BREAKPOINT
        : false;
  const semesterSkeletonCount = resolvedIsMobile ? 2 : 3;

  return (
    <div style={{ background: "#f4f4f5", minHeight: "100vh", color: "#111" }}>
      <style>
        {`
          @keyframes dashboard-skeleton-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 300,
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: resolvedIsMobile ? "12px 16px" : "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: resolvedIsMobile ? "wrap" : "nowrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SkeletonBlock height={30} width={34} radius={8} />
          <SkeletonBlock height={24} width={110} radius={8} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: resolvedIsMobile ? "stretch" : "center",
            gap: resolvedIsMobile ? 10 : 24,
            width: resolvedIsMobile ? "100%" : "auto",
            justifyContent: resolvedIsMobile ? "space-between" : "flex-end",
          }}
        >
          <div style={{ flex: resolvedIsMobile ? 1 : "unset", minWidth: 0 }}>
            <SkeletonBlock
              height={16}
              width={resolvedIsMobile ? "100%" : 140}
              radius={6}
            />
            {!resolvedIsMobile && (
              <>
                <SkeletonBlock
                  height={12}
                  width={120}
                  radius={6}
                  style={{ marginTop: 8 }}
                />
                <SkeletonBlock
                  height={12}
                  width={100}
                  radius={6}
                  style={{ marginTop: 6 }}
                />
              </>
            )}
          </div>
          <SkeletonBlock height={40} width={92} radius={8} />
        </div>

        {resolvedIsMobile && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
              width: "100%",
            }}
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "#fafafa",
                }}
              >
                <SkeletonBlock height={10} width="55%" radius={6} />
                <SkeletonBlock
                  height={14}
                  width="70%"
                  radius={6}
                  style={{ marginTop: 8 }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{ padding: resolvedIsMobile ? "20px 16px 8px" : "24px 24px 8px" }}
      >
        <SkeletonBlock height={34} width={180} radius={10} />
        <SkeletonBlock
          height={14}
          width={resolvedIsMobile ? "100%" : 420}
          radius={8}
          style={{ marginTop: 12 }}
        />

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <SkeletonBlock height={44} width={150} radius={10} />
          <SkeletonBlock height={44} width={116} radius={10} />
          {resolvedIsMobile && <SkeletonBlock height={44} width={130} radius={10} />}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection:
            resolvedIsMobile || resolvedIsTabletLayout ? "column" : "row",
          gap: resolvedIsMobile ? 16 : resolvedIsTabletLayout ? 20 : 24,
          alignItems: "flex-start",
          padding:
            resolvedIsMobile
              ? "0 16px 24px"
              : resolvedIsTabletLayout
                ? "0 20px 24px"
                : "0 24px 24px",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            width: "100%",
          }}
        >
          {Array.from({ length: semesterSkeletonCount }).map((_, index) => (
            <div
              key={index}
              style={{
                width: "100%",
                background: "#fefefe",
                borderRadius: 12,
                padding: resolvedIsMobile ? 12 : 16,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: resolvedIsMobile ? 10 : 12,
                borderLeft: "6px solid #dbeafe",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 220 }}>
                  <SkeletonBlock height={22} width={160} radius={8} />
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <SkeletonBlock height={36} width={80} radius={8} />
                    <SkeletonBlock height={36} width={76} radius={8} />
                    <SkeletonBlock height={36} width={68} radius={8} />
                  </div>
                </div>
                <SkeletonBlock
                  height={70}
                  width={resolvedIsMobile ? "100%" : 250}
                  radius={10}
                />
              </div>

              {[0, 1].map((courseRow) => (
                <div
                  key={courseRow}
                  style={{
                    padding: resolvedIsMobile ? 10 : 12,
                    borderRadius: 10,
                    background: "#fff",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                >
                  <SkeletonBlock height={16} width="70%" radius={6} />
                  <SkeletonBlock
                    height={12}
                    width={90}
                    radius={6}
                    style={{ marginTop: 8 }}
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <SkeletonBlock height={36} width={110} radius={8} />
                    <SkeletonBlock height={36} width={90} radius={8} />
                    <SkeletonBlock height={36} width={80} radius={8} />
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <SkeletonBlock height={14} width={120} radius={6} />
                <SkeletonBlock height={14} width={90} radius={6} />
                <SkeletonBlock height={14} width={100} radius={6} />
              </div>
            </div>
          ))}
        </div>

        {!resolvedIsMobile && (
          <div
            style={{
              width: resolvedIsTabletLayout ? "100%" : 320,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 14,
                padding: 14,
                border: "1px solid #eee",
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              }}
            >
              <SkeletonBlock height={18} width={90} radius={8} />
              <SkeletonBlock
                height={12}
                width={70}
                radius={6}
                style={{ marginTop: 8 }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 10,
                      background: "#fafafa",
                    }}
                  >
                    <SkeletonBlock height={12} width="100%" radius={6} />
                    <SkeletonBlock
                      height={6}
                      width="100%"
                      radius={999}
                      style={{ marginTop: 10 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
