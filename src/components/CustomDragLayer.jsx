import { useRef } from "react";
import { useDragLayer } from "react-dnd";

function buildPreviewStyle(currentOffset, item) {
  return {
    position: "fixed",
    pointerEvents: "none",
    top: currentOffset.y - (item.grabOffsetY ?? 0),
    left: currentOffset.x - (item.grabOffsetX ?? 0),
    zIndex: 1000,
    maxWidth: Math.min(item.width || 280, 320),
  };
}

function MinimalCoursePreview({ code, number, name, credits }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
        border: "1px solid rgba(17,17,17,0.08)",
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>
        {number ? `${code} ${number}` : code}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#111827",
          lineHeight: 1.3,
          marginTop: 2,
        }}
      >
        {name}
      </div>
      {credits != null && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          {credits} credits
        </div>
      )}
    </div>
  );
}

export default function CustomDragLayer() {
  const lastOffset = useRef(null);

  const { itemType, isDragging, item, currentOffset, initialOffset } = useDragLayer(
    (monitor) => ({
      item: monitor.getItem(),
      itemType: monitor.getItemType(),
      isDragging: monitor.isDragging(),
      currentOffset: monitor.getClientOffset() ?? monitor.getSourceClientOffset(),
      initialOffset: monitor.getInitialClientOffset() ?? monitor.getInitialSourceClientOffset(),
    }),
  );

  if (!lastOffset.current && initialOffset) lastOffset.current = initialOffset;
  if (currentOffset) lastOffset.current = currentOffset;
  const displayOffset = currentOffset ?? lastOffset.current;

  if (!isDragging || !displayOffset || !item) {
    lastOffset.current = null;
    return null;
  }

  const style = buildPreviewStyle(displayOffset, item);

  if (itemType === "COURSE") {
    return (
      <div style={style}>
        <MinimalCoursePreview
          code={item.course?.courses?.code ?? "ELECTIVE"}
          number={item.course?.courses?.number ?? ""}
          name={item.course?.courses?.name ?? "Elective Slot"}
          credits={item.course?.courses?.credits ?? 0}
        />
      </div>
    );
  }

  if (itemType === "SIDEBAR_COURSE") {
    return (
      <div style={style}>
        {item.course ? (
          <MinimalCoursePreview
            code={item.course.code}
            number={item.course.number}
            name={item.course.name}
            credits={item.course.credits}
          />
        ) : (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#fff",
              boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
              border: "1px solid rgba(37,99,235,0.2)",
              minWidth: 180,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>
              ELECTIVE SLOT
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#111827",
                lineHeight: 1.3,
                marginTop: 2,
              }}
            >
              {item.electiveAttribute}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}