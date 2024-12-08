import React, { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

const TooltipComponent = ({
  children,
  tooltip = '',
}: {
  children: ReactNode;
  tooltip?: ReactNode;
}) => {
  return (
    <Tooltip>
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

export default TooltipComponent;
