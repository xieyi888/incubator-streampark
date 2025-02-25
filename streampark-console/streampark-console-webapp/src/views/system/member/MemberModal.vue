<!--
  Licensed to the Apache Software Foundation (ASF) under one or more
  contributor license agreements.  See the NOTICE file distributed with
  this work for additional information regarding copyright ownership.
  The ASF licenses this file to You under the Apache License, Version 2.0
  (the "License"); you may not use this file except in compliance with
  the License.  You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->
<template>
  <BasicModal
    :okButtonProps="{ class: 'e2e-member-submit-btn' }"
    :cancelButtonProps="{ class: 'e2e-member-cancel-btn' }"
    :width="600"
    v-bind="$attrs"
    @register="registerModal"
    centered
    showFooter
    @ok="handleSubmit"
    :minHeight="120"
  >
    <template #title>
      <Icon icon="ant-design:user-add-outlined" />
      {{ getTitle }}
    </template>
    <div class="mt-4">
      <BasicForm @register="registerForm" :schemas="getMemberFormSchema" />
    </div>
  </BasicModal>
</template>

<script setup lang="ts" name="MemberDrawer">
  import { ref, computed, unref } from 'vue';
  import { BasicForm, FormSchema, useForm } from '/@/components/Form';
  import { BasicModal, useModalInner } from '/@/components/Modal';

  import { Icon } from '/@/components/Icon';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { RoleListItem } from '/@/api/base/model/systemModel';
  import { useUserStoreWithOut } from '/@/store/modules/user';
  import { fetchAddMember, fetchCandidateUsers, fetchUpdateMember } from '/@/api/system/member';
  import { useFormValidate } from '/@/hooks/web/useFormValidate';
  const { t } = useI18n();
  const userStore = useUserStoreWithOut();
  const { getItemProp, setValidateStatus, setHelp } = useFormValidate();

  const emit = defineEmits(['success', 'register']);
  const props = defineProps({
    roleOptions: {
      type: Array as PropType<Array<Partial<RoleListItem>>>,
      default: () => [],
    },
  });

  const isUpdate = ref(false);
  const editParams: {
    userId: Nullable<number>;
    id: Nullable<number>;
    teamId: Nullable<number>;
  } = {
    userId: null,
    id: null,
    teamId: null,
  };

  const getMemberFormSchema = computed((): FormSchema[] => {
    return [
      {
        field: 'userName',
        label: t('system.member.table.userName'),
        component: 'ApiSelect',
        componentProps: {
          disabled: unref(isUpdate),
          api: fetchCandidateUsers,
          labelField: 'username',
          valueField: 'username',
          showSearch: true,
          optionFilterGroup: 'username',
          placeholder: t('system.member.userNameRequire'),
        },
        itemProps: getItemProp.value,
        rules: unref(isUpdate)
          ? []
          : [
              {
                required: true,
                message: t('system.member.userNameRequire'),
                trigger: 'blur',
              },
            ],
      },
      {
        field: 'roleId',
        label: t('system.member.table.roleName'),
        component: 'Select',
        componentProps: {
          options: props.roleOptions,
          fieldNames: { label: 'roleName', value: 'roleId' },
          placeholder: t('system.member.roleRequire'),
        },
        rules: [{ required: true, message: t('system.member.roleRequire') }],
      },
    ];
  });
  const [registerForm, { resetFields, setFieldsValue, validate }] = useForm({
    name: 'MemberForm',
    colon: true,
    showActionButtonGroup: false,
    layout: 'vertical',
    baseColProps: { span: 22, offset: 1 },
  });

  const [registerModal, { setModalProps, closeModal }] = useModalInner(async (data: Recordable) => {
    setValidateStatus('');
    setHelp('');
    Object.assign(editParams, { userId: null, id: null });
    resetFields();
    setModalProps({ confirmLoading: false });
    isUpdate.value = !!data?.isUpdate;
    if (isUpdate.value) {
      Object.assign(editParams, {
        userId: data.record.userId,
        id: data.record.id,
        teamId: userStore.getTeamId,
      });
    }
    if (unref(isUpdate)) {
      setFieldsValue({
        userName: data.record.userName,
        roleId: data.record.roleId,
      });
    }
  });

  const getTitle = computed(() =>
    !unref(isUpdate) ? t('system.member.addMember') : t('system.member.modifyMember'),
  );
  // form submit
  async function handleSubmit() {
    try {
      const values = await validate();
      setModalProps({ confirmLoading: true });
      await (isUpdate.value
        ? fetchUpdateMember({ ...editParams, ...values })
        : fetchAddMember({ ...values }));
      closeModal();
      emit('success', isUpdate.value);
    } catch (e) {
      console.error(e);
    } finally {
      setModalProps({ confirmLoading: false });
    }
  }
</script>
