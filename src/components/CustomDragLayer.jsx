import { useEffect, useRef } from "react";
import { useDragLayer } from "react-dnd";

function isScrollable(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;

  return (
    (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
    element.scrollHeight > element.clientHeight
  );
}

function findScrollContainer(x, y) {
  const target = document.elementFromPoint(x, y);
  let current = target;

  while (current && current !== document.body) {
    if (isScrollable(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return document.scrollingElement || document.documentElement;
}

function scrollContainer(container, speed) {
  if (!container || speed === 0) return;

  if (
    container === document.body ||
    container === document.documentElement ||
    container === document.scrollingElement
  ) {
    window.scrollBy(0, speed);
    return;
  }

  container.scrollTop += speed;
}

function getContainerViewport(container) {
  if (
    container === document.body ||
    container === document.documentElement ||
    container === document.scrollingElement
  ) {
    return { top: 0, bottom: window.innerHeight };
  }

  const rect = container.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom };
}

function buildPreviewStyle(currentOffset, item, isMobile) {
  return {
    position: "fixed",
    pointerEvents: "none",
    top: currentOffset.y - (item.grabOffsetY ?? 0),
    left: currentOffset.x - (item.grabOffsetX ?? 0),
    zIndex: 1000,
    width: isMobile ? undefined : item.width,
    maxWidth: isMobile ? Math.min(item.width || 280, 320) : undefined,
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

export default function CustomDragLayer({ isMobile = false }) {
  const lastOffset = useRef(null);
  const dragOffsetRef = useRef(null);
  const frameRef = useRef(null);
  const scrollStateRef = useRef({
    direction: 0,
    since: 0,
  });

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
  dragOffsetRef.current = displayOffset;

  useEffect(() => {
    if (!isMobile || typeof document === "undefined") return undefined;

    document.body.classList.toggle("mobile-dnd-active", isDragging);
    document.documentElement.classList.toggle("mobile-dnd-active-scroll", isDragging);

    return () => {
      document.body.classList.remove("mobile-dnd-active");
      document.documentElement.classList.remove("mobile-dnd-active-scroll");
    };
  }, [isDragging, isMobile]);

  useEffect(() => {
    if (!isMobile || !isDragging || typeof window === "undefined") {
      return undefined;
    }

    const EDGE_SIZE = 150;
    const BASE_MAX_SPEED = 5;
    const BOOST_MAX_SPEED = 8;

    const tick = () => {
      const offset = dragOffsetRef.current;
      if (!offset) {
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const container = findScrollContainer(offset.x, offset.y);
      const { top, bottom } = getContainerViewport(container);
      let speed = 0;
      let direction = 0;
      const now = performance.now();

      if (offset.y < top + EDGE_SIZE) {
        direction = -1;
        speed = -BASE_MAX_SPEED * (1 - (offset.y - top) / EDGE_SIZE);
      } else if (offset.y > bottom - EDGE_SIZE) {
        direction = 1;
        speed = BASE_MAX_SPEED * ((offset.y - (bottom - EDGE_SIZE)) / EDGE_SIZE);
      }

      if (direction !== 0) {
        if (scrollStateRef.current.direction !== direction) {
          scrollStateRef.current.direction = direction;
          scrollStateRef.current.since = now;
        }

        const holdMs = now - scrollStateRef.current.since;
        const boostProgress = Math.min(1, holdMs / 1400);
        const boostSpeed = BOOST_MAX_SPEED * boostProgress;
        speed += direction * boostSpeed;
      } else {
        scrollStateRef.current.direction = 0;
        scrollStateRef.current.since = 0;
      }

      scrollContainer(container, speed);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      scrollStateRef.current.direction = 0;
      scrollStateRef.current.since = 0;
    };
  }, [isDragging, isMobile]);

  if (!isDragging || !displayOffset || !item) {
    lastOffset.current = null;
    dragOffsetRef.current = null;
    scrollStateRef.current.direction = 0;
    scrollStateRef.current.since = 0;
    return null;
  }

  const style = buildPreviewStyle(displayOffset, item, isMobile);

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