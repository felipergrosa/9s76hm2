import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import KanbanCard from "./KanbanCard";
import KanbanLaneHeader from "./KanbanLaneHeader";

const useStyles = makeStyles(theme => ({
    lane: {
        width: 350,
        minWidth: 350,
        maxWidth: 350,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.palette.background.paper,
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        overflow: "hidden",
        height: "100%",
        maxHeight: "calc(100vh - 200px)",
    },
    cardsContainer: {
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: 8,
        minHeight: 100,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": {
            display: "none",
        },
    },
    cardWrapper: {
        marginBottom: 8,
        width: "100%",
    },
    draggingOver: {
        backgroundColor: "rgba(0, 0, 0, 0.03)",
    },
}));

export default function KanbanLane({ lane, onCardClick, allTags, onMoveRequest, innerRef, draggableProps, dragHandleProps, onPanStart }) {
    const classes = useStyles();

    return (
        <div
            className={classes.lane}
            ref={innerRef}
            {...draggableProps}
            style={{ ...draggableProps?.style, borderTop: `4px solid ${lane.laneColor || "#5C5C5C"}` }}
        >
            <KanbanLaneHeader
                id={lane.id}
                title={lane.title}
                label={lane.label}
                unreadCount={lane.unreadCount}
                laneColor={lane.laneColor}
                dragHandleProps={dragHandleProps}
                onPanStart={onPanStart}
            />

            <Droppable droppableId={lane.id.toString()}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`${classes.cardsContainer} ${snapshot.isDraggingOver ? classes.draggingOver : ""}`}
                    >
                        {(lane.cards || []).map((card, index) => (
                            <Draggable
                                key={card.id.toString()}
                                draggableId={card.id.toString()}
                                index={index}
                            >
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={classes.cardWrapper}
                                        style={{
                                            ...provided.draggableProps.style,
                                            opacity: snapshot.isDragging ? 0.9 : 1,
                                            transform: snapshot.isDragging
                                                ? provided.draggableProps.style?.transform
                                                : "none",
                                        }}
                                    >
                                        <KanbanCard
                                            ticket={card.ticket}
                                            allTags={allTags}
                                            onClick={() => onCardClick(card.ticket?.uuid)}
                                            onMoveRequest={(tagId) => onMoveRequest && onMoveRequest(card.ticket, tagId)}
                                        />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
}
