import { useDragLayer } from "react-dnd";
import CourseCard from "./CourseCard";

export default function CustomDragLayer() {
  const { itemType, isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getClientOffset(),
  }));

if (!isDragging || !currentOffset || !item) return null;

  const style = {
    position: "fixed",
    pointerEvents: "none",
    top: currentOffset.y - item.grabOffsetY, // align grab point
    left: currentOffset.x - item.grabOffsetX,
    width: item.width,
    height: item.height,
    zIndex: 1000,
  };

  if (itemType === "COURSE") {
    return (
      <div style={style}>
        <CourseCard
          course={item.course}
          semesterStatus={item.course.semester_status || "present"}
          updateCourse={() => {}}
        />
      </div>
    );
  }
  // Handle sidebar course cards
  if (itemType === "SIDEBAR_COURSE" && item.course) {
    return (
      <div style={style}>
        <div style={{
          padding: 12,
          borderRadius: 10,
          background: "#fff",
          boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
          border: "2px solid #111",
          width: "100%",
        }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {item.course.code}
          </div>
          <div style={{ fontSize: 13, color: "#374151" }}>
            {item.course.name}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Credits: {item.course.credits}
          </div>
        </div>
      </div>
    );
  }

  return null;
}