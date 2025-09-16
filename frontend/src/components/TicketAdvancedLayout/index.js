import { styled } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';

const TicketAdvancedLayout = styled(Paper)({
    height: `calc(100% - 48px)`,
    maxHeight: '100%',
    display: "grid",
    gridTemplateRows: "auto 1fr",
    overflow: 'hidden'
})

export default TicketAdvancedLayout;