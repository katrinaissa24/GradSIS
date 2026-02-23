import { useDragLayer } from "react-dnd";
import CourseCard from "./CourseCard";

export default function CustomDragLayer() {
  const { itemType, isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getClientOffset(),
  }));

  if (!isDragging || !currentOffset || !item || !item.course) return null;

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

  return null;
}