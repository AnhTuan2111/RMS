package vn.edu.fpt.swp391.g6.rimsapi.util;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
@RequiredArgsConstructor
public class WebSocketBroadcaster
{
    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastAfterCommit(String topic, Object payload)
    {
        if (TransactionSynchronizationManager.isSynchronizationActive())
        {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization()
            {
                @Override
                public void afterCommit()
                {
                    messagingTemplate.convertAndSend(topic, payload);
                }
            });
        }
        else
        {
            messagingTemplate.convertAndSend(topic, payload);
        }
    }
}