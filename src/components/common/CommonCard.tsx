import { Card, CardContent, Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface CommonCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  gradient?: boolean;
}

const CommonCard = ({
  title,
  subtitle,
  icon,
  actions,
  children,
  gradient = false,
}: CommonCardProps) => {
  return (
    <Card
      elevation={0}
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'rgba(15, 23, 42, 0.06)',
        boxShadow: '0 20px 60px -30px rgba(15, 23, 42, 0.2)',
        background: gradient
          ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
          : '#ffffff',
      }}
    >
      {(title || icon) && (
        <Box
          sx={{
            px: 3,
            py: 2.5,
            background:
              'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(6, 182, 212, 0.06) 100%)',
            borderBottom: '1px solid rgba(15, 23, 42, 0.05)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {icon && (
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                  color: '#fff',
                  boxShadow: '0 8px 20px -8px rgba(79, 70, 229, 0.6)',
                }}
              >
                {icon}
              </Box>
            )}
            <Box sx={{ flex: 1 }}>
              {title && (
                <Typography variant="h6" color="text.primary">
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {actions}
          </Box>
        </Box>
      )}
      <CardContent sx={{ p: 3 }}>{children}</CardContent>
    </Card>
  );
};

export default CommonCard;
