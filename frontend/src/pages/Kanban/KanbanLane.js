import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Button } from "@material-ui/core";
import { Add as AddIcon } from "@material-ui/icons";
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
        // Snap de coluna no scroll horizontal do board (mobile)
        scrollSnapAlign: "start",
        [theme.breakpoints.down("sm")]: {
            // Em telas <600px a coluna cabe no viewport com "peek" da próxima
            width: "calc(100vw - 76px)",
            minWidth: "calc(100vw - 76px)",
            maxWidth: "calc(100vw - 76px)",
            // Altura governada pela linha do grid, não por 100vh
            maxHeight: "100%",
        },
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
    addDealBtn: {
        margin: "0 8px 8px",
        justifyContent: "flex-start",
        textTransform: "none",
        fontSize: 12,
        color: "#777",
        borderRadius: 8,
        flexShrink: 0,
    },
}));

export default function KanbanLane({ lane, laneIndex, compact, focusedCardIndex = -1, onCardClick, allTags, onMoveRequest, innerRef, draggableProps, dragHandleProps, onPanStart, onAddDeal, onEditLane, onDeleteLane, onEditDeal, onDeleteDeal }) {
    const classes = useStyles();

    return (
        <div
            className={`${classes.lane} bento-panel`}
            ref={innerRef}
            {...draggableProps}
            style={{ ...draggableProps?.style }}
            data-kanban-lane={laneIndex}
        >
            {/* Acento de cor da fase — div fina no topo (o border do .bento-panel
                é !important e sobrescreveria um borderTop inline) */}
            <div
                style={{
                    height: 4,
                    flexShrink: 0,
                    background: lane.laneColor || "#5C5C5C",
                }}
            />
            <KanbanLaneHeader
                id={lane.id}
                title={lane.title}
                label={lane.label}
                unreadCount={lane.unreadCount}
                laneColor={lane.laneColor}
                laneTotal={lane.dealTotal}
                onEditLane={onEditLane}
                onDeleteLane={onDeleteLane}
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
                                        data-kanban-card={index}
                                        style={{
                                            ...provided.draggableProps.style,
                                            opacity: snapshot.isDragging ? 0.9 : 1,
                                            transform: snapshot.isDragging
                                                ? provided.draggableProps.style?.transform
                                                : "none",
                                            // Destaque do card focado via teclado (↑/↓ + Enter)
                                            outline: focusedCardIndex === index ? "2px solid #1976d2" : "none",
                                            outlineOffset: 1,
                                            borderRadius: 8,
                                        }}
                                    >
                                        <KanbanCard
                                            ticket={card.ticket}
                                            allTags={allTags}
                                            compact={compact}
                                            onClick={() => onCardClick(card.ticket)}
                                            onMoveRequest={(tagId) => onMoveRequest && onMoveRequest(card.ticket, tagId)}
                                            onEditDeal={onEditDeal}
                                            onDeleteDeal={onDeleteDeal}
                                        />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>

            {onAddDeal && (
                <Button
                    className={classes.addDealBtn}
                    startIcon={<AddIcon style={{ fontSize: 14 }} />}
                    onClick={onAddDeal}
                    fullWidth
                >
                    Adicionar negócio
                </Button>
            )}
        </div>
    );
}
