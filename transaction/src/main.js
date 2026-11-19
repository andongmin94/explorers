// index.html hosts lessons 01, 03 and 04 (?lesson=…); lesson 02 lives on
// deadlock.html. Both page modules load statically so the shared switcher
// (mounted on DOMContentLoaded) finds the header they draw.
import { currentLesson, lessonHref } from "../../shared/lesson-rail.js";
import { LESSONS } from "./lessons.js";
import { start as startLostUpdate } from "./lost-update-main.js";
import { start as startIsolation } from "./isolation-main.js";

const lesson = currentLesson(LESSONS);
if (lesson.href) location.replace(lessonHref(LESSONS, lesson));
else if (lesson.id === "lost-update") startLostUpdate();
else startIsolation(lesson.id);
