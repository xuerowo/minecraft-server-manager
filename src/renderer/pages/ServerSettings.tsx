import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, Typography, Empty } from 'antd';
import { useServerStore } from '../store/serverStore';
import { ServerPropertiesEditor } from '../components/ServerSettings/ServerPropertiesEditor';
import { useI18n } from '../hooks/useI18n';

const { Title } = Typography;

export const ServerSettings: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const { servers } = useServerStore();
  const { t } = useI18n();
  const server = serverId ? servers.find(s => s.id === serverId) : null;

  if (!server) {
    return (
      <div className="p-6">
        <Card>
          <Empty
            description={t('console.selectServerFirst')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ServerPropertiesEditor 
        serverId={server.id}
        serverName={server.name}
      />
    </div>
  );
};